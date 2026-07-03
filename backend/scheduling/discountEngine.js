import {
  isMultiClassSystemRule,
  isMonthlySpendSystemRule,
  isHouseholdSpendVolumeRule,
  multiClassDiscountTarget,
  monthlySpendDiscountTarget,
  multiClassMinPayingClasses,
  monthlySpendMinPaidClasses,
  pickMultiClassTier,
  pickMonthlySpendTier,
  accountStatsFromLine,
  attachCartAccountStats,
  mapTierRow,
  spendTierQualificationLabel,
  multiClassTierQualificationLabel,
  nextSpendTierHint,
  nextMultiClassTierHint,
} from './systemDiscounts.js'

// Discount + promo rules engine. Pure computation over already-resolved base (list) prices,
// plus DB helpers for loading rules and enforcing layered caps via the redemption ledger.
//
// Amounts: percent rules store amount_value in BASIS POINTS (5000 = 50%, 1250 = 12.5%);
// fixed rules store amount_value in CENTS. All money is integer cents. Estimate-only.

export const DISCOUNT_TYPES = [
  'promo_code',
  'school',
  'city',
  'multi_class',
  'multi_child',
  'spend_volume',
  'free_classes',
]

export function discountAmountCents(baseCents, amountType, amountValue) {
  const base = Math.max(0, Math.round(Number(baseCents) || 0))
  const value = Math.max(0, Number(amountValue) || 0)
  if (amountType === 'percent') {
    return Math.min(base, Math.round((base * value) / 10000))
  }
  return Math.min(base, Math.round(value))
}

function normalizeText(s) {
  return String(s ?? '').trim().toLowerCase()
}

/** US high school grade (9–12) from graduation year, or null if out of range. */
function inferGradeFromGraduationYear(gradYear, now = new Date()) {
  const y = Number(gradYear)
  if (!Number.isFinite(y)) return null
  const month = now.getMonth()
  const schoolYearEnd = month >= 6 ? now.getFullYear() + 1 : now.getFullYear()
  const yearsUntilGrad = y - schoolYearEnd
  if (yearsUntilGrad < 0) return null
  const grade = 12 - yearsUntilGrad
  if (grade < 9 || grade > 12) return null
  return grade
}

function ruleValueList(value) {
  if (Array.isArray(value)) return value
  if (value === '' || value == null) return []
  return [value]
}

function matchesEligibilityRule(rule, line) {
  const values = ruleValueList(rule.value)
  if (values.length === 0) return true

  let actual = null
  switch (rule.field) {
    case 'school':
      actual = normalizeText(line.memberSchool)
      break
    case 'graduation_year':
      actual = line.memberGraduationYear != null ? Number(line.memberGraduationYear) : null
      break
    case 'grade_level': {
      const direct = line.memberGradeLevel != null ? Number(line.memberGradeLevel) : null
      actual =
        direct != null && Number.isFinite(direct)
          ? direct
          : inferGradeFromGraduationYear(line.memberGraduationYear)
      break
    }
    default:
      return true
  }
  if (actual == null || actual === '') return false

  const op = rule.operator || 'is'
  if (rule.field === 'school') {
    const targets = values.map(normalizeText).filter(Boolean)
    const hit = targets.some((t) => actual === t || actual.includes(t))
    if (op === 'is' || op === 'in') return hit
    if (op === 'is_not' || op === 'not_in') return !hit
    return hit
  }

  const nums = values.map(Number).filter((n) => Number.isFinite(n))
  const n = Number(actual)
  if (op === 'is') return nums.length > 0 && n === nums[0]
  if (op === 'is_not') return nums.length > 0 && n !== nums[0]
  if (op === 'in') return nums.includes(n)
  if (op === 'not_in') return !nums.includes(n)
  return true
}

/** AND-combined eligibility rules stored on promo config. */
function passesEligibilityRules(rule, line) {
  const rules = rule.config?.eligibility_rules
  if (!Array.isArray(rules) || rules.length === 0) return true
  return rules.every((r) => matchesEligibilityRule(r, line))
}

function isPromoFreeAccess(rule) {
  return rule.type === 'promo_code' && rule.config?.discountKind === 'free_access'
}

function isFreeGrantRule(rule) {
  return rule.type === 'free_classes' || isPromoFreeAccess(rule)
}

function offeringMatchesRule(rule, line) {
  const cfg = rule.config || {}
  const ids = Array.isArray(cfg.class_offering_ids)
    ? cfg.class_offering_ids.map(Number)
    : cfg.offering_id != null
      ? [Number(cfg.offering_id)]
      : []
  if (ids.length === 0) return true
  return line.offeringId != null && ids.includes(Number(line.offeringId))
}

/** Paid-class position on the account for tiered multi-class / spend rules. */
function accountOrdinalForLine(line) {
  const accountCount = line.accountPaidClassCount ?? line.familyPaidClassCount
  if (accountCount != null && accountCount > 0) return accountCount
  return line.classOrdinal || 0
}

/** Tier whose threshold is the greatest <= ordinal (e.g. 3rd class uses the "3" tier, else "2"). */
function tierForOrdinal(rule, ordinal) {
  const tiers = (rule.tiers || [])
    .filter((t) => Number(t.threshold) <= ordinal)
    .sort((a, b) => Number(b.threshold) - Number(a.threshold))
  return tiers[0] || null
}

function withinWindow(rule, now) {
  if (rule.startsAt && new Date(rule.startsAt).getTime() > now) return false
  if (rule.endsAt && new Date(rule.endsAt).getTime() < now) return false
  return true
}

/** Does a rule's targeting scope match a given line? */
function scopeMatchesLine(rule, line) {
  switch (rule.scopeLevel) {
    case 'global':
      return true
    case 'sport':
      return rule.scopeRefId != null && Number(rule.scopeRefId) === Number(line.sportId)
    case 'program':
      return rule.scopeRefId != null && Number(rule.scopeRefId) === Number(line.programId)
    case 'class':
      return rule.scopeRefId != null && Number(rule.scopeRefId) === Number(line.formId)
    case 'offering':
      return rule.scopeRefId != null && Number(rule.scopeRefId) === Number(line.offeringId)
    default:
      return false
  }
}

/** Per-line eligibility for line-targeted discount types (school, city, promo, multi_class, free). */
function lineEligible(rule, line, promoCodesLower) {
  if (line.costUsesSelections) {
    if (!line.costDiscountRuleIds?.has(Number(rule.id))) return false
  } else if (!scopeMatchesLine(rule, line)) {
    return false
  }
  if (!passesEligibilityRules(rule, line)) return false
  switch (rule.type) {
    case 'promo_code': {
      const code = normalizeText(rule.config?.code)
      if (code === '' || !promoCodesLower.has(code)) return false
      if (line.costUsesSelections) {
        const allowed = line.costAllowedPromoCodes
        if (!Array.isArray(allowed) || allowed.length === 0) return false
        const allowedSet = new Set(allowed.map(normalizeText))
        if (!allowedSet.has(code)) return false
      } else {
        const allowed = line.programAllowedPromoCodes
        if (Array.isArray(allowed)) {
          if (allowed.length === 0) return false
          const allowedSet = new Set(allowed.map(normalizeText))
          if (!allowedSet.has(code)) return false
        }
      }
      return true
    }
    case 'school': {
      const names = (rule.config?.school_names || []).map(normalizeText).filter(Boolean)
      const target = normalizeText(line.memberSchool)
      if (!target || names.length === 0) return false
      return rule.config?.match === 'contains'
        ? names.some((n) => target.includes(n))
        : names.includes(target)
    }
    case 'city': {
      const cities = (rule.config?.cities || []).map(normalizeText).filter(Boolean)
      const target = normalizeText(line.memberCity)
      if (!target || cities.length === 0) return false
      return cities.includes(target)
    }
    case 'multi_class':
    case 'free_classes':
      return true
    default:
      return false
  }
}

/**
 * Cap tracker enforces layered limits using existing ledger counts plus this order's tally.
 * Free grants count "units"; discounts count "redemptions". A rule is skipped if applying it
 * would exceed any applicable cap.
 */
function makeCapTracker(caps) {
  const used = {
    freeFacility: caps.freeUnitsFacilityUsed || 0,
    discountFacility: caps.discountRedemptionsFacilityUsed || 0,
    byRule: new Map(),
    byProgramFree: new Map(),
    byProgramDiscount: new Map(),
    byClassFree: new Map(),
    byClassDiscount: new Map(),
  }
  for (const [k, v] of Object.entries(caps.ruleRedeemed || {})) used.byRule.set(Number(k), v)
  for (const [k, v] of Object.entries(caps.programFreeUsed || {})) used.byProgramFree.set(Number(k), v)
  for (const [k, v] of Object.entries(caps.programDiscountUsed || {})) used.byProgramDiscount.set(Number(k), v)
  for (const [k, v] of Object.entries(caps.classFreeUsed || {})) used.byClassFree.set(Number(k), v)
  for (const [k, v] of Object.entries(caps.classDiscountUsed || {})) used.byClassDiscount.set(Number(k), v)

  function get(map, key) {
    return map.get(Number(key)) || 0
  }

  return {
    canApply(rule, line, kind, units = 1) {
      // Facility-wide caps.
      if (kind === 'free' && caps.maxFreeUnitsTotal != null && used.freeFacility + units > caps.maxFreeUnitsTotal) {
        return false
      }
      if (kind === 'discount' && caps.maxDiscountRedemptionsTotal != null && used.discountFacility + 1 > caps.maxDiscountRedemptionsTotal) {
        return false
      }
      // Per-rule max redemptions.
      if (rule.maxRedemptions != null) {
        const total = (rule.redeemedCount || 0) + get(used.byRule, rule.id)
        if (total + 1 > rule.maxRedemptions) return false
      }
      // Per-program / per-class discount-redemption caps.
      if (kind === 'discount') {
        if (line.programMaxDiscountRedemptions != null &&
            get(used.byProgramDiscount, line.programId) + 1 > line.programMaxDiscountRedemptions) {
          return false
        }
        if (line.classMaxDiscountRedemptions != null &&
            get(used.byClassDiscount, line.formId) + 1 > line.classMaxDiscountRedemptions) {
          return false
        }
      }
      // Per-program / per-class free caps.
      if (kind === 'free') {
        if (line.programMaxFreeTotal != null &&
            get(used.byProgramFree, line.programId) + units > line.programMaxFreeTotal) {
          return false
        }
        if (line.classMaxFreeTotal != null &&
            get(used.byClassFree, line.formId) + units > line.classMaxFreeTotal) {
          return false
        }
      }
      return true
    },
    record(rule, line, kind, units = 1) {
      if (kind === 'free') {
        used.freeFacility += units
        used.byProgramFree.set(Number(line.programId), get(used.byProgramFree, line.programId) + units)
        used.byClassFree.set(Number(line.formId), get(used.byClassFree, line.formId) + units)
      } else {
        used.discountFacility += 1
        used.byProgramDiscount.set(Number(line.programId), get(used.byProgramDiscount, line.programId) + 1)
        used.byClassDiscount.set(Number(line.formId), get(used.byClassDiscount, line.formId) + 1)
      }
      used.byRule.set(Number(rule.id), get(used.byRule, rule.id) + 1)
    },
  }
}

/**
 * computeOrderDiscounts: applies the discount pipeline to lines with resolved base prices.
 *
 * @param {{
 *   lines: Array<{ key, formId, programId, sportId, offeringId, memberId,
 *                  memberCity, memberSchool, classOrdinal, childOrdinal, baseCents,
 *                  programMaxFreeTotal?, classMaxFreeTotal?,
 *                  programMaxDiscountRedemptions?, classMaxDiscountRedemptions? }>,
 *   rules: Array<object>,
 *   promoCodes?: string[],
 *   caps?: object,
 *   now?: number,
 * }} input
 */
export function computeOrderDiscounts({ lines = [], rules = [], promoCodes = [], caps = {}, now = Date.now() }) {
  attachCartAccountStats(lines, rules)
  const promoCodesLower = new Set(promoCodes.map(normalizeText).filter(Boolean))
  const capTracker = makeCapTracker(caps)

  function promoCodesForLine(line) {
    const set = new Set(promoCodesLower)
    if (Array.isArray(line.autoPromoCodes)) {
      for (const c of line.autoPromoCodes) set.add(normalizeText(c))
    }
    return set
  }

  function orderRuleAllowedByCosts(rule) {
    if (!lineState.some((ls) => ls.line.costUsesSelections)) return true
    return lineState.some((ls) => ls.line.costDiscountRuleIds?.has(Number(rule.id)))
  }

  const activeRules = rules
    .filter((r) => r.active !== false && withinWindow(r, now))
    .sort((a, b) => {
      if (a.calcBase !== b.calcBase) return a.calcBase === 'pre' ? -1 : 1
      return (a.priority ?? 100) - (b.priority ?? 100)
    })

  const lineState = lines.map((line) => ({
    key: line.key,
    line,
    includeInSubtotal: line.includeInSubtotal !== false,
    baseCents: Math.max(0, Math.round(Number(line.baseCents) || 0)),
    runningCents: Math.max(0, Math.round(Number(line.baseCents) || 0)),
    applied: [],
    exclusivityGroups: new Set(),
  }))
  const lineByKey = new Map(lineState.map((ls) => [ls.key, ls]))

  const orderDiscounts = []
  const freeGrants = []
  const redemptions = []
  const subtotalCents = lineState
    .filter((ls) => ls.includeInSubtotal !== false)
    .reduce((sum, ls) => sum + ls.baseCents, 0)
  let orderRunning = subtotalCents

  function applyToLine(ls, rule, amountType, amountValue, kind = 'discount') {
    if (rule.exclusivityGroup && ls.exclusivityGroups.has(rule.exclusivityGroup)) return 0
    if (!rule.stackable && ls.applied.length > 0 && ls.applied.some((a) => a.ruleId !== rule.id)) {
      // Non-stackable: only apply if nothing else applied to this line.
      return 0
    }
    const base = rule.calcBase === 'post' ? ls.runningCents : ls.baseCents
    let amount = kind === 'free' ? ls.runningCents : discountAmountCents(base, amountType, amountValue)
    if (rule.maxDiscountCents != null) amount = Math.min(amount, rule.maxDiscountCents)
    amount = Math.min(amount, ls.runningCents)
    if (amount <= 0) return 0
    if (!capTracker.canApply(rule, ls.line, kind, kind === 'free' ? 1 : 1)) return 0

    ls.runningCents -= amount
    ls.applied.push({ ruleId: rule.id, name: rule.name, type: rule.type, amountCents: amount, kind })
    if (rule.exclusivityGroup) ls.exclusivityGroups.add(rule.exclusivityGroup)
    capTracker.record(rule, ls.line, kind, 1)
    redemptions.push({
      ruleId: rule.id,
      memberId: ls.line.memberId,
      lineKey: ls.key,
      programId: ls.line.programId,
      formId: ls.line.formId,
      kind,
      units: kind === 'free' ? 1 : 0,
      amountCents: amount,
    })
    return amount
  }

  function applyTierMaxCap(rule, tier, amount) {
    let capped = amount
    if (tier.maxDiscountCents != null) capped = Math.min(capped, tier.maxDiscountCents)
    if (rule.maxDiscountCents != null) capped = Math.min(capped, rule.maxDiscountCents)
    return capped
  }

  function accountGroupKey(line) {
    if (line.familyId != null) return `family:${Number(line.familyId)}`
    if (line.memberId != null) return `member:${Number(line.memberId)}`
    return 'cart:default'
  }

  function applyAccountSystemDiscount(rule, { pickTier, getTarget, passesGate, describeTier, nextTierHint }) {
    const target = getTarget(rule)
    const groups = new Map()
    for (const ls of lineState) {
      const key = accountGroupKey(ls.line)
      if (key == null) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(ls)
    }

    for (const groupLines of groups.values()) {
      const sample = groupLines[0]?.line ?? {}
      const stats = accountStatsFromLine(sample)
      if (!passesGate(stats)) continue
      const tier = pickTier(rule, stats)
      if (!tier) continue

      const qualifiedLabel = describeTier ? describeTier(tier) : null
      const unlockHint = nextTierHint ? nextTierHint(tier, stats) : null

      const cartLines = groupLines.filter(
        (ls) => ls.includeInSubtotal !== false && ls.line.shadowOnly !== true,
      )
      if (cartLines.length === 0) continue

      const classLines = groupLines.filter((ls) => ls.baseCents > 0)
      if (classLines.length === 0) continue

      if (target === 'total') {
        const accountSubtotal = classLines.reduce((sum, ls) => sum + ls.baseCents, 0)
        let amount = discountAmountCents(accountSubtotal, tier.amountType, tier.amountValue)
        amount = applyTierMaxCap(rule, tier, amount)
        if (amount <= 0) continue

        const cartSubtotal = cartLines.reduce((sum, ls) => sum + ls.baseCents, 0)
        const hasShadowLines = classLines.some((ls) => ls.line.shadowOnly === true)
        const repLine = cartLines[0] ?? classLines[0]
        if (cartSubtotal <= 0 && !hasShadowLines) continue
        if (!capTracker.canApply(rule, repLine.line, 'discount')) continue

        amount = Math.min(amount, accountSubtotal)

        if (hasShadowLines) {
          orderRunning -= amount
          orderDiscounts.push({
            ruleId: rule.id,
            name: rule.name,
            type: rule.type,
            amountCents: amount,
            qualifiedLabel,
            nextTierHint: unlockHint,
          })
          capTracker.record(rule, repLine.line, 'discount')
          redemptions.push({
            ruleId: rule.id,
            memberId: repLine.line.memberId,
            lineKey: null,
            programId: repLine.line.programId,
            formId: repLine.line.formId,
            kind: 'discount',
            units: 0,
            amountCents: amount,
          })
          continue
        }

        const eligible = cartLines.filter((ls) => ls.runningCents > 0)
        let remaining = amount
        for (let i = 0; i < eligible.length; i += 1) {
          const ls = eligible[i]
          const share =
            i === eligible.length - 1
              ? remaining
              : Math.min(remaining, Math.round(amount * (ls.baseCents / cartSubtotal)))
          if (share <= 0) continue
          const applied = Math.min(share, ls.runningCents)
          ls.runningCents -= applied
          remaining -= applied
          ls.applied.push({
            ruleId: rule.id,
            name: rule.name,
            type: rule.type,
            amountCents: applied,
            kind: 'discount',
            qualifiedLabel,
            nextTierHint: unlockHint,
          })
          if (rule.exclusivityGroup) ls.exclusivityGroups.add(rule.exclusivityGroup)
          redemptions.push({
            ruleId: rule.id,
            memberId: ls.line.memberId,
            lineKey: ls.key,
            programId: ls.line.programId,
            formId: ls.line.formId,
            kind: 'discount',
            units: 0,
            amountCents: applied,
          })
        }
        capTracker.record(rule, repLine.line, 'discount')
        continue
      }

      let pick =
        target === 'highest'
          ? classLines.reduce((best, ls) => (ls.baseCents > best.baseCents ? ls : best))
          : classLines.reduce((best, ls) => (ls.baseCents < best.baseCents ? ls : best))

      if (pick.line.shadowOnly) {
        const cartOnly = cartLines.filter((ls) => ls.runningCents > 0)
        if (cartOnly.length === 0) continue
        pick =
          target === 'highest'
            ? cartOnly.reduce((best, ls) => (ls.baseCents > best.baseCents ? ls : best))
            : cartOnly.reduce((best, ls) => (ls.baseCents < best.baseCents ? ls : best))
      } else if (!cartLines.some((ls) => ls.key === pick.key)) {
        const cartOnly = cartLines.filter((ls) => ls.runningCents > 0)
        if (cartOnly.length === 0) continue
        pick =
          target === 'highest'
            ? cartOnly.reduce((best, ls) => (ls.baseCents > best.baseCents ? ls : best))
            : cartOnly.reduce((best, ls) => (ls.baseCents < best.baseCents ? ls : best))
      }

      const base = rule.calcBase === 'post' ? pick.runningCents : pick.baseCents
      let amount = discountAmountCents(base, tier.amountType, tier.amountValue)
      amount = applyTierMaxCap(rule, tier, amount)
      amount = Math.min(amount, pick.runningCents)
      if (amount <= 0) continue
      if (rule.exclusivityGroup && pick.exclusivityGroups.has(rule.exclusivityGroup)) continue
      if (
        !rule.stackable &&
        pick.applied.length > 0 &&
        pick.applied.some((a) => a.ruleId !== rule.id)
      ) {
        continue
      }
      if (!capTracker.canApply(rule, pick.line, 'discount')) continue
      pick.runningCents -= amount
      pick.applied.push({
        ruleId: rule.id,
        name: rule.name,
        type: rule.type,
        amountCents: amount,
        kind: 'discount',
        qualifiedLabel,
        nextTierHint: unlockHint,
      })
      if (rule.exclusivityGroup) pick.exclusivityGroups.add(rule.exclusivityGroup)
      capTracker.record(rule, pick.line, 'discount')
      redemptions.push({
        ruleId: rule.id,
        memberId: pick.line.memberId,
        lineKey: pick.key,
        programId: pick.line.programId,
        formId: pick.line.formId,
        kind: 'discount',
        units: 0,
        amountCents: amount,
      })
    }
  }

  function applyMultiClassSystemDiscount(rule) {
    applyAccountSystemDiscount(rule, {
      getTarget: multiClassDiscountTarget,
      pickTier: pickMultiClassTier,
      passesGate: (stats) => (stats.paidClassCount ?? 0) >= multiClassMinPayingClasses(rule),
      describeTier: multiClassTierQualificationLabel,
      nextTierHint: (tier, stats) => nextMultiClassTierHint(rule, tier, stats),
    })
  }

  function applyMonthlySpendSystemDiscount(rule) {
    applyAccountSystemDiscount(rule, {
      getTarget: monthlySpendDiscountTarget,
      pickTier: pickMonthlySpendTier,
      passesGate: (stats) => (stats.paidClassCount ?? 0) >= monthlySpendMinPaidClasses(rule),
      describeTier: spendTierQualificationLabel,
      nextTierHint: (tier, stats) => nextSpendTierHint(rule, tier, stats),
    })
  }

  for (const rule of activeRules) {
    if (isMultiClassSystemRule(rule)) {
      applyMultiClassSystemDiscount(rule)
      continue
    }
    if (isHouseholdSpendVolumeRule(rule)) {
      applyMonthlySpendSystemDiscount(rule)
      continue
    }
    if (rule.applyTo === 'order_total') {
      if (!orderRuleAllowedByCosts(rule)) continue
      // Order-level: compute on order subtotal/running, applied once, distributed across lines.
      let base = rule.calcBase === 'post' ? orderRunning : subtotalCents
      // Tiered order-level (multi_class/multi_child) keyed by qualifying count.
      let amountType = rule.amountType
      let amountValue = rule.amountValue
      if (rule.type === 'multi_class' || rule.type === 'multi_child') {
        const ordinal =
          rule.type === 'multi_class'
            ? Math.max(0, ...lineState.map((ls) => accountOrdinalForLine(ls.line)))
            : Math.max(0, ...lineState.map((ls) => ls.line.childOrdinal || 0))
        if (rule.type === 'multi_class' && ordinal < multiClassMinPayingClasses(rule)) continue
        const tier = tierForOrdinal(rule, ordinal)
        if (!tier) continue
        amountType = tier.amountType
        amountValue = tier.amountValue
      } else if (rule.type === 'spend_volume') {
        const ordinal = Math.max(0, ...lineState.map((ls) => accountOrdinalForLine(ls.line)))
        const minClasses = monthlySpendMinPaidClasses(rule) || 2
        if (ordinal < minClasses) continue
      }
      // School/city/promo order-level need at least one eligible line.
      if (['promo_code', 'school', 'city'].includes(rule.type)) {
        if (!lineState.some((ls) => lineEligible(rule, ls.line, promoCodesForLine(ls.line)))) continue
      }
      let amount = discountAmountCents(base, amountType, amountValue)
      if (rule.maxDiscountCents != null) amount = Math.min(amount, rule.maxDiscountCents)
      amount = Math.min(amount, orderRunning)
      if (amount <= 0) continue
      const repLine = lineState[0]?.line
      if (repLine && !capTracker.canApply(rule, repLine, 'discount')) continue

      orderRunning -= amount
      orderDiscounts.push({ ruleId: rule.id, name: rule.name, type: rule.type, amountCents: amount })
      if (repLine) capTracker.record(rule, repLine, 'discount')
      redemptions.push({
        ruleId: rule.id,
        memberId: repLine?.memberId ?? null,
        lineKey: null,
        programId: repLine?.programId ?? null,
        formId: repLine?.formId ?? null,
        kind: 'discount',
        units: 0,
        amountCents: amount,
      })
      continue
    }

    // Per-class rules.
    for (const ls of lineState) {
      if (isFreeGrantRule(rule)) {
        const cfg = rule.config || {}
        if (!offeringMatchesRule(rule, ls.line)) continue
        if (!lineEligible(rule, ls.line, promoCodesForLine(ls.line))) continue
        const amount = applyToLine(ls, rule, rule.amountType, rule.amountValue, 'free')
        if (amount > 0) {
          const unit = cfg.grant_unit || cfg.benefit_type || 'slot'
          freeGrants.push({
            ruleId: rule.id,
            lineKey: ls.key,
            unit,
            quantity: Number(cfg.quantity ?? 1),
            amountCents: amount,
          })
        }
        continue
      }

      let amountType = rule.amountType
      let amountValue = rule.amountValue
      if (rule.type === 'multi_class') {
        if (isMultiClassSystemRule(rule)) continue
        if (ls.line.costUsesSelections && !ls.line.costDiscountRuleIds?.has(Number(rule.id))) continue
        const ordinal = accountOrdinalForLine(ls.line)
        if (ordinal < multiClassMinPayingClasses(rule)) continue
        const tier = tierForOrdinal(rule, ordinal)
        if (!tier) continue
        amountType = tier.amountType
        amountValue = tier.amountValue
      } else if (rule.type === 'spend_volume') {
        if (isHouseholdSpendVolumeRule(rule)) continue
        if (ls.line.costUsesSelections && !ls.line.costDiscountRuleIds?.has(Number(rule.id))) continue
        const ordinal = accountOrdinalForLine(ls.line)
        const minClasses = monthlySpendMinPaidClasses(rule) || 2
        if (ordinal < minClasses) continue
        const tier = tierForOrdinal(rule, ordinal)
        if (!tier) continue
        amountType = tier.amountType
        amountValue = tier.amountValue
      } else if (rule.type === 'multi_child') {
        if (ls.line.costUsesSelections && !ls.line.costDiscountRuleIds?.has(Number(rule.id))) continue
        const tier = tierForOrdinal(rule, ls.line.childOrdinal || 0)
        if (!tier) continue
        amountType = tier.amountType
        amountValue = tier.amountValue
      } else if (!lineEligible(rule, ls.line, promoCodesForLine(ls.line))) {
        continue
      }
      applyToLine(ls, rule, amountType, amountValue, 'discount')
    }
  }

  const lineResults = lineState
    .filter((ls) => ls.includeInSubtotal !== false)
    .map((ls) => ({
      key: ls.key,
      baseCents: ls.baseCents,
      discountCents: ls.baseCents - ls.runningCents,
      finalCents: ls.runningCents,
      applied: ls.applied,
    }))

  const lineDiscountTotal = lineResults.reduce((sum, l) => sum + l.discountCents, 0)
  const orderDiscountTotal = orderDiscounts.reduce((sum, d) => sum + d.amountCents, 0)
  const totalDiscountCents = lineDiscountTotal + orderDiscountTotal
  const totalCents = Math.max(0, subtotalCents - totalDiscountCents)

  return {
    lines: lineResults,
    orderDiscounts,
    freeGrants,
    redemptions,
    subtotalCents,
    totalDiscountCents,
    totalCents,
  }
}

// ---------- DB helpers ----------

export async function loadActiveDiscountRules(pool, facilityId) {
  let rulesRes
  try {
    rulesRes = await pool.query(
      `SELECT * FROM discount_rule
       WHERE active = TRUE AND (facility_id = $1 OR facility_id IS NULL)`,
      [facilityId],
    )
  } catch {
    return []
  }
  if (rulesRes.rows.length === 0) return []

  const ruleIds = rulesRes.rows.map((r) => Number(r.id))
  const tiersRes = await pool.query(
    `SELECT * FROM discount_rule_tier WHERE rule_id = ANY($1::bigint[]) ORDER BY threshold ASC`,
    [ruleIds],
  )
  const tiersByRule = new Map()
  for (const t of tiersRes.rows) {
    const list = tiersByRule.get(Number(t.rule_id)) || []
    list.push(mapTierRow(t))
    tiersByRule.set(Number(t.rule_id), list)
  }

  return rulesRes.rows.map((r) => ({
    id: Number(r.id),
    facilityId: r.facility_id != null ? Number(r.facility_id) : null,
    name: r.name,
    description: r.description,
    type: r.type,
    amountType: r.amount_type,
    amountValue: Number(r.amount_value),
    applyTo: r.apply_to,
    calcBase: r.calc_base,
    priority: Number(r.priority ?? 100),
    stackable: r.stackable !== false,
    exclusivityGroup: r.exclusivity_group || null,
    maxDiscountCents: r.max_discount_cents != null ? Number(r.max_discount_cents) : null,
    scopeLevel: r.scope_level,
    scopeRefId: r.scope_ref_id != null ? Number(r.scope_ref_id) : null,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    maxRedemptions: r.max_redemptions != null ? Number(r.max_redemptions) : null,
    redeemedCount: Number(r.redeemed_count ?? 0),
    config: r.config || {},
    tiers: tiersByRule.get(Number(r.id)) || [],
  }))
}

/** Aggregate redemption counts for cap enforcement (facility-wide and per program/class/rule). */
export async function loadRedemptionCaps(pool, facilityId) {
  const caps = {
    maxFreeUnitsTotal: null,
    maxDiscountRedemptionsTotal: null,
    freeUnitsFacilityUsed: 0,
    discountRedemptionsFacilityUsed: 0,
    ruleRedeemed: {},
    programFreeUsed: {},
    programDiscountUsed: {},
    classFreeUsed: {},
    classDiscountUsed: {},
  }
  try {
    const settingsRes = await pool.query(
      `SELECT max_free_units_total, max_discount_redemptions_total
       FROM discount_global_settings WHERE facility_id = $1`,
      [facilityId],
    )
    if (settingsRes.rows[0]) {
      caps.maxFreeUnitsTotal = settingsRes.rows[0].max_free_units_total
      caps.maxDiscountRedemptionsTotal = settingsRes.rows[0].max_discount_redemptions_total
    }

    const totalsRes = await pool.query(
      `SELECT
         COALESCE(SUM(units) FILTER (WHERE kind = 'free'), 0) AS free_units,
         COUNT(*) FILTER (WHERE kind = 'discount') AS discount_count
       FROM discount_redemption`,
    )
    caps.freeUnitsFacilityUsed = Number(totalsRes.rows[0]?.free_units ?? 0)
    caps.discountRedemptionsFacilityUsed = Number(totalsRes.rows[0]?.discount_count ?? 0)

    const byRuleRes = await pool.query(
      `SELECT rule_id, COUNT(*) AS c FROM discount_redemption WHERE rule_id IS NOT NULL GROUP BY rule_id`,
    )
    for (const row of byRuleRes.rows) caps.ruleRedeemed[Number(row.rule_id)] = Number(row.c)

    const byProgRes = await pool.query(
      `SELECT program_id, kind, COALESCE(SUM(units),0) AS units, COUNT(*) AS c
       FROM discount_redemption WHERE program_id IS NOT NULL GROUP BY program_id, kind`,
    )
    for (const row of byProgRes.rows) {
      if (row.kind === 'free') caps.programFreeUsed[Number(row.program_id)] = Number(row.units)
      else caps.programDiscountUsed[Number(row.program_id)] = Number(row.c)
    }

    const byClassRes = await pool.query(
      `SELECT form_id, kind, COALESCE(SUM(units),0) AS units, COUNT(*) AS c
       FROM discount_redemption WHERE form_id IS NOT NULL GROUP BY form_id, kind`,
    )
    for (const row of byClassRes.rows) {
      if (row.kind === 'free') caps.classFreeUsed[Number(row.form_id)] = Number(row.units)
      else caps.classDiscountUsed[Number(row.form_id)] = Number(row.c)
    }
  } catch {
    // Tables may not exist yet; return empty caps (no limits).
  }
  return caps
}

/**
 * Snapshot a computed order breakdown onto the relevant signup rows and write the redemption
 * ledger. Best-effort: never throws (estimate-only pricing must not block signups).
 *
 * @param {object} pool
 * @param {{ breakdown: object, keyToSignupId: Record<string, number>, fallbackSignupId: number }} args
 */
export async function persistDiscountSnapshot(pool, { breakdown, keyToSignupId = {}, fallbackSignupId = null }) {
  if (!breakdown || !breakdown.enabled) return
  try {
    // Per-line snapshot of the resolved breakdown for audit + display.
    for (const line of breakdown.lines || []) {
      const signupId = keyToSignupId[line.key] ?? fallbackSignupId
      if (signupId == null) continue
      await pool.query(
        `UPDATE scheduling_signup SET pricing_breakdown = $2::jsonb WHERE id = $1`,
        [
          signupId,
          JSON.stringify({
            line,
            orderDiscounts: breakdown.orderDiscounts,
            totals: {
              subtotalCents: breakdown.subtotalCents,
              totalDiscountCents: breakdown.totalDiscountCents,
              totalCents: breakdown.totalCents,
            },
          }),
        ],
      )
    }
    // Redemption ledger rows + per-rule counters.
    for (const r of breakdown.redemptions || []) {
      const signupId = (r.lineKey != null ? keyToSignupId[r.lineKey] : null) ?? fallbackSignupId
      if (signupId == null) continue
      await pool.query(
        `INSERT INTO discount_redemption
          (rule_id, member_id, signup_id, program_id, form_id, kind, units, amount_cents)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          r.ruleId ?? null,
          r.memberId ?? null,
          signupId,
          r.programId ?? null,
          r.formId ?? null,
          r.kind || 'discount',
          r.units ?? 0,
          r.amountCents ?? 0,
        ],
      )
      if (r.ruleId != null) {
        await pool.query(
          `UPDATE discount_rule SET redeemed_count = redeemed_count + 1, updated_at = now() WHERE id = $1`,
          [r.ruleId],
        )
      }
    }
  } catch (err) {
    console.warn('[scheduling] persistDiscountSnapshot:', err.message)
  }
}

/** Persist the computed redemptions for a signup and bump per-rule redeemed_count. */
export async function recordRedemptions(client, signupId, redemptions = []) {
  if (!redemptions.length) return
  for (const r of redemptions) {
    await client.query(
      `INSERT INTO discount_redemption
        (rule_id, member_id, signup_id, program_id, form_id, kind, units, amount_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        r.ruleId ?? null,
        r.memberId ?? null,
        signupId,
        r.programId ?? null,
        r.formId ?? null,
        r.kind || 'discount',
        r.units ?? 0,
        r.amountCents ?? 0,
      ],
    )
    if (r.ruleId != null) {
      await client.query(
        `UPDATE discount_rule SET redeemed_count = redeemed_count + 1, updated_at = now() WHERE id = $1`,
        [r.ruleId],
      )
    }
  }
}
