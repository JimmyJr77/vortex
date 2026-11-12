import Joi from 'joi'
import crypto from 'node:crypto'
import { id, inputError } from './common.js'
import { loadEffectivePricingForForm } from '../programs/pricingDefaults.js'

const schema = Joi.object({
  displayName: Joi.string().trim().min(1).max(255).required(),
  abridgedName: Joi.string().max(255).allow('', null),
  programsId: Joi.number().integer().positive().allow(null),
  skillLevel: Joi.string().valid('EARLY_STAGE','BEGINNER','INTERMEDIATE','ADVANCED').allow('',null),
  ageMin: Joi.number().integer().min(0).max(100).allow(null),
  ageMax: Joi.number().integer().min(0).max(100).allow(null),
  description: Joi.string().allow('',null), skillRequirements: Joi.string().allow('',null),
  isActive: Joi.boolean(), monthlyPriceCents: Joi.number().integer().min(0).max(2147483647),
})

async function applyMonthlyPrice(client,forms,monthlyPriceCents) {
  if(monthlyPriceCents==null)return
  for(const form of forms) {
    const {effective}=await loadEffectivePricingForForm(client,form)
    // Metadata-only saves retain existing allocation, cadence and option flags.
    if(effective.costUnit==='per_month' && effective.costAmountCents===monthlyPriceCents)continue
    await client.query(`UPDATE scheduling_form SET class_monthly_price_cents=$2,slot_cost_monthly_cents=$2,cost_amount_cents=$2,cost_unit='per_month',pricing_overrides_program=TRUE,
      max_slots_per_user=$3,free_slots_per_user=$4,max_free_slots_total=$5,max_discount_redemptions=$6,updated_at=now() WHERE id=$1`,
      [form.id,monthlyPriceCents,effective.maxSlotsPerUser,effective.freeSlotsPerUser,effective.maxFreeSlotsTotal,effective.maxDiscountRedemptions])
  }
}

async function classForms(client,klass,parent) {
  let forms=(await client.query('SELECT * FROM scheduling_form WHERE program_id=$1 AND deleted_at IS NULL ORDER BY id FOR UPDATE',[klass.id])).rows
  if(!forms.length) forms=(await client.query(`INSERT INTO scheduling_form(program_id,programs_id,title,is_active,signup_fields,mandate_waiver) VALUES($1,$2,$3,$4,COALESCE($5::jsonb,'["first_name","last_name","email"]'::jsonb),$6) RETURNING *`,[klass.id,klass.programs_id,klass.display_name,klass.is_active,parent?.scheduling_signup_fields?JSON.stringify(parent.scheduling_signup_fields):null,Boolean(parent?.scheduling_mandate_waiver)])).rows
  return forms
}

// Pricing and Create/Edit Class share this writer and the same canonical forms.
// A price-only edit must never overwrite class metadata or subscription prices.
export async function saveClassPrice(pool,facilityId,classId,body) {
  const {error,value}=Joi.object({monthlyPriceCents:Joi.number().integer().min(0).max(2147483647).required()}).validate(body,{convert:false})
  if(error)throw inputError(error.details[0].message)
  const client=await pool.connect()
  try {
    await client.query('BEGIN')
    const klass=(await client.query('SELECT * FROM program WHERE id=$1 AND facility_id=$2 FOR UPDATE',[id(classId),id(facilityId)])).rows[0]
    if(!klass)throw inputError('Class not found.',404)
    const parent=klass.programs_id?(await client.query('SELECT * FROM programs WHERE id=$1 AND facility_id=$2',[klass.programs_id,facilityId])).rows[0]:null
    await applyMonthlyPrice(client,await classForms(client,klass,parent),value.monthlyPriceCents)
    await client.query('COMMIT')
    return {id:Number(klass.id),monthlyPriceCents:value.monthlyPriceCents}
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}

// One transaction writes the existing canonical class and its forms. Never touch
// scheduling_signup, billing_subscription, charges, payments, or price adjustments.
export async function saveClass(pool, facilityId, classId, body) {
  const { error, value } = schema.validate(body, { convert: false })
  if (error) throw inputError(error.details[0].message)
  if (!classId && value.monthlyPriceCents == null) throw inputError('Monthly price is required for a new class.')
  const client=await pool.connect()
  try {
    await client.query('BEGIN')
    let klass
    if (classId) {
      klass=(await client.query('SELECT * FROM program WHERE id=$1 AND facility_id=$2 FOR UPDATE',[id(classId),id(facilityId)])).rows[0]
      if (!klass) throw inputError('Class not found.',404)
    }
    const parentId=klass?.programs_id ?? value.programsId
    let parent
    if (parentId) {
      parent=(await client.query('SELECT * FROM programs WHERE id=$1 AND facility_id=$2 FOR UPDATE',[parentId,facilityId])).rows[0]
      if (!parent) throw inputError('Program not found.',404)
      if ((parent.archived || parent.is_active === false) && value.isActive !== false) throw inputError('Restore the program before activating this class.')
    } else if (!klass) throw inputError('Program is required.')
    const values=[value.displayName,value.abridgedName || value.displayName,value.skillLevel || null,value.ageMin ?? null,value.ageMax ?? null,value.description ?? '',value.skillRequirements ?? '',value.isActive !== false]
    if (klass) {
      await client.query('UPDATE program SET display_name=$1,abridged_name=$2,skill_level=$3,age_min=$4,age_max=$5,description=$6,skill_requirements=$7,is_active=$8,updated_at=now() WHERE id=$9',[...values,klass.id])
    } else {
      klass=(await client.query(`INSERT INTO program(display_name,abridged_name,skill_level,age_min,age_max,description,skill_requirements,is_active,facility_id,programs_id,category,name)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,(enum_range(NULL::program_category))[1],$11) RETURNING *`,[...values,facilityId,parentId,`CLASS_${crypto.randomUUID()}`])).rows[0]
    }
    const forms=await classForms(client,klass,parent)
    await client.query('UPDATE scheduling_form SET title=$2,is_active=$3,updated_at=now() WHERE program_id=$1 AND deleted_at IS NULL',[klass.id,value.displayName,value.isActive !== false])
    await applyMonthlyPrice(client,forms,value.monthlyPriceCents)
    await client.query('COMMIT')
    return { id:Number(klass.id) }
  } catch(error) { await client.query('ROLLBACK');throw error } finally {client.release()}
}
