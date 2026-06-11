// Relationship-aware entity registry for the admin "DB Queries" report builder.
//
// Each base entity exposes:
//   - fields:    its own selectable columns (expr uses the base alias `t0`)
//   - relations: reachable related entities (depth 1). Only columns/relations
//                defined here are ever offered or accepted — table and column
//                names are NEVER taken raw from the client.
//
// to-one relations join with a fixed alias `j_<relKey>`.
// to-many relations are aggregated in a subquery (alias `m_<relKey>`) so the
// base entity always yields one row (prevents row explosion). Inside that
// subquery the target table is aliased `tgt` and any bridge table `bridge`.
//
// `password_hash` is intentionally never registered.

const memberOwnFields = [
  { key: 'first_name', label: 'First name', expr: 't0.first_name', type: 'text' },
  { key: 'last_name', label: 'Last name', expr: 't0.last_name', type: 'text' },
  { key: 'email', label: 'Email', expr: 't0.email', type: 'text' },
  { key: 'phone', label: 'Phone', expr: 't0.phone', type: 'text' },
  { key: 'address', label: 'Address', expr: 't0.address', type: 'text' },
  { key: 'date_of_birth', label: 'Date of birth', expr: 't0.date_of_birth', type: 'date' },
  { key: 'gender', label: 'Gender', expr: 't0.gender', type: 'text' },
  { key: 'status', label: 'Status', expr: 't0.status', type: 'text' },
  { key: 'is_active', label: 'Active', expr: 't0.is_active', type: 'boolean' },
  { key: 'billing_street', label: 'Billing street', expr: 't0.billing_street', type: 'text' },
  { key: 'billing_city', label: 'Billing city', expr: 't0.billing_city', type: 'text' },
  { key: 'billing_state', label: 'Billing state', expr: 't0.billing_state', type: 'text' },
  { key: 'billing_zip', label: 'Billing ZIP', expr: 't0.billing_zip', type: 'text' },
  { key: 'medical_concerns', label: 'Medical concerns', expr: 't0.medical_concerns', type: 'text' },
  { key: 'medical_notes', label: 'Medical notes', expr: 't0.medical_notes', type: 'text' },
  { key: 'internal_flags', label: 'Internal flags', expr: 't0.internal_flags', type: 'text' },
  { key: 'created_at', label: 'Created at', expr: 't0.created_at', type: 'date' },
]

export const ENTITIES = {
  member: {
    key: 'member',
    label: 'Athletes / People',
    table: 'member',
    pk: 'id',
    fields: memberOwnFields,
    relations: {
      family: {
        label: 'Family',
        cardinality: 'one',
        joinSql: 'LEFT JOIN family j_family ON j_family.id = t0.family_id',
        fields: [
          { key: 'family_name', label: 'Family name', expr: 'j_family.family_name', type: 'text' },
        ],
      },
      schools: {
        label: 'Schools',
        cardinality: 'many',
        from: 'member_school bridge JOIN school tgt ON tgt.id = bridge.school_id',
        baseLink: 'bridge.member_id',
        fields: [
          { key: 'name', label: 'School name', expr: 'tgt.name', type: 'text' },
          { key: 'level', label: 'School level', expr: 'tgt.level', type: 'text' },
          { key: 'location', label: 'School location', expr: 'tgt.location', type: 'text' },
        ],
      },
      parents: {
        label: 'Parents / Guardians',
        cardinality: 'many',
        from: 'parent_guardian_authority bridge JOIN member tgt ON tgt.id = bridge.parent_member_id',
        baseLink: 'bridge.child_member_id',
        fields: [
          { key: 'first_name', label: 'Parent first name', expr: 'tgt.first_name', type: 'text' },
          { key: 'last_name', label: 'Parent last name', expr: 'tgt.last_name', type: 'text' },
          { key: 'email', label: 'Parent email', expr: 'tgt.email', type: 'text' },
          { key: 'phone', label: 'Parent phone', expr: 'tgt.phone', type: 'text' },
        ],
      },
      children: {
        label: 'Children',
        cardinality: 'many',
        from: 'parent_guardian_authority bridge JOIN member tgt ON tgt.id = bridge.child_member_id',
        baseLink: 'bridge.parent_member_id',
        fields: [
          { key: 'first_name', label: 'Child first name', expr: 'tgt.first_name', type: 'text' },
          { key: 'last_name', label: 'Child last name', expr: 'tgt.last_name', type: 'text' },
        ],
      },
      enrollments: {
        label: 'Program enrollments',
        cardinality: 'many',
        from: 'member_program bridge JOIN program tgt ON tgt.id = bridge.program_id',
        baseLink: 'bridge.member_id',
        fields: [
          { key: 'program', label: 'Program', expr: 'tgt.display_name', type: 'text' },
          { key: 'category', label: 'Program category', expr: 'tgt.category::text', type: 'text' },
          { key: 'days_per_week', label: 'Days/week', expr: 'bridge.days_per_week', type: 'number' },
        ],
      },
      emergencyContacts: {
        label: 'Emergency contacts',
        cardinality: 'many',
        from: 'emergency_contact tgt',
        baseLink: 'tgt.member_id',
        fields: [
          { key: 'name', label: 'Contact name', expr: 'tgt.name', type: 'text' },
          { key: 'relationship', label: 'Contact relationship', expr: 'tgt.relationship', type: 'text' },
          { key: 'phone', label: 'Contact phone', expr: 'tgt.phone', type: 'text' },
          { key: 'email', label: 'Contact email', expr: 'tgt.email', type: 'text' },
        ],
      },
      inquiries: {
        label: 'Inquiries',
        cardinality: 'many',
        from: 'registrations tgt',
        baseLink: 'tgt.member_id',
        fields: [
          { key: 'created_at', label: 'Inquiry date', expr: 'tgt.created_at', type: 'date' },
          { key: 'interest', label: 'Inquiry interest', expr: 'tgt.interest', type: 'text' },
          { key: 'message', label: 'Inquiry message', expr: 'tgt.message', type: 'text' },
          { key: 'lead_status', label: 'Lead status', expr: 'tgt.lead_status', type: 'text' },
        ],
      },
      notes: {
        label: 'Notes',
        cardinality: 'many',
        from: 'note tgt',
        baseLink: 'tgt.subject_id',
        extraWhere: "tgt.subject_type = 'member' AND tgt.is_deleted = FALSE",
        fields: [
          { key: 'note_type', label: 'Note type', expr: 'tgt.note_type', type: 'text' },
          { key: 'body', label: 'Note body', expr: 'tgt.body', type: 'text' },
          { key: 'author_name', label: 'Note author', expr: 'tgt.author_name', type: 'text' },
          { key: 'created_at', label: 'Note date', expr: 'tgt.created_at', type: 'date' },
        ],
      },
    },
  },

  school: {
    key: 'school',
    label: 'Schools',
    table: 'school',
    pk: 'id',
    fields: [
      { key: 'name', label: 'Name', expr: 't0.name', type: 'text' },
      { key: 'level', label: 'Level', expr: 't0.level', type: 'text' },
      { key: 'location', label: 'Location', expr: 't0.location', type: 'text' },
      { key: 'is_verified', label: 'Verified', expr: 't0.is_verified', type: 'boolean' },
      { key: 'is_active', label: 'Active', expr: 't0.is_active', type: 'boolean' },
      { key: 'created_at', label: 'Created at', expr: 't0.created_at', type: 'date' },
    ],
    relations: {
      students: {
        label: 'Students',
        cardinality: 'many',
        from: 'member_school bridge JOIN member tgt ON tgt.id = bridge.member_id',
        baseLink: 'bridge.school_id',
        fields: [
          { key: 'first_name', label: 'Student first name', expr: 'tgt.first_name', type: 'text' },
          { key: 'last_name', label: 'Student last name', expr: 'tgt.last_name', type: 'text' },
          { key: 'email', label: 'Student email', expr: 'tgt.email', type: 'text' },
          { key: 'phone', label: 'Student phone', expr: 'tgt.phone', type: 'text' },
        ],
      },
    },
  },

  family: {
    key: 'family',
    label: 'Families',
    table: 'family',
    pk: 'id',
    fields: [
      { key: 'family_name', label: 'Family name', expr: 't0.family_name', type: 'text' },
      { key: 'created_at', label: 'Created at', expr: 't0.created_at', type: 'date' },
    ],
    relations: {
      members: {
        label: 'Members',
        cardinality: 'many',
        from: 'member tgt',
        baseLink: 'tgt.family_id',
        fields: [
          { key: 'first_name', label: 'Member first name', expr: 'tgt.first_name', type: 'text' },
          { key: 'last_name', label: 'Member last name', expr: 'tgt.last_name', type: 'text' },
          { key: 'email', label: 'Member email', expr: 'tgt.email', type: 'text' },
          { key: 'status', label: 'Member status', expr: 'tgt.status', type: 'text' },
        ],
      },
    },
  },

  inquiry: {
    key: 'inquiry',
    label: 'Inquiries',
    table: 'registrations',
    pk: 'id',
    fields: [
      { key: 'first_name', label: 'First name', expr: 't0.first_name', type: 'text' },
      { key: 'last_name', label: 'Last name', expr: 't0.last_name', type: 'text' },
      { key: 'email', label: 'Email', expr: 't0.email', type: 'text' },
      { key: 'phone', label: 'Phone', expr: 't0.phone', type: 'text' },
      { key: 'athlete_age', label: 'Athlete age', expr: 't0.athlete_age', type: 'number' },
      { key: 'interest', label: 'Interest', expr: 't0.interest', type: 'text' },
      { key: 'message', label: 'Message', expr: 't0.message', type: 'text' },
      { key: 'contacted', label: 'Contacted', expr: 't0.contacted', type: 'boolean' },
      { key: 'follow_up', label: 'Follow up', expr: 't0.follow_up', type: 'boolean' },
      { key: 'lead_status', label: 'Lead status', expr: 't0.lead_status', type: 'text' },
      { key: 'created_at', label: 'Created at', expr: 't0.created_at', type: 'date' },
    ],
    relations: {
      member: {
        label: 'Linked member',
        cardinality: 'one',
        joinSql: 'LEFT JOIN member j_member ON j_member.id = t0.member_id',
        fields: [
          { key: 'first_name', label: 'Member first name', expr: 'j_member.first_name', type: 'text' },
          { key: 'last_name', label: 'Member last name', expr: 'j_member.last_name', type: 'text' },
          { key: 'status', label: 'Member status', expr: 'j_member.status', type: 'text' },
        ],
      },
      notes: {
        label: 'Notes',
        cardinality: 'many',
        from: 'note tgt',
        baseLink: 'tgt.subject_id',
        extraWhere: "tgt.subject_type = 'registration' AND tgt.is_deleted = FALSE",
        fields: [
          { key: 'note_type', label: 'Note type', expr: 'tgt.note_type', type: 'text' },
          { key: 'body', label: 'Note body', expr: 'tgt.body', type: 'text' },
          { key: 'author_name', label: 'Note author', expr: 'tgt.author_name', type: 'text' },
          { key: 'created_at', label: 'Note date', expr: 'tgt.created_at', type: 'date' },
        ],
      },
    },
  },
}

// Shape served to the UI: entities with their own fields + relation groups.
export function getRegistryForClient() {
  return Object.values(ENTITIES).map((e) => ({
    key: e.key,
    label: e.label,
    fields: e.fields.map((f) => ({ key: f.key, label: f.label, type: f.type })),
    relations: Object.entries(e.relations || {}).map(([relKey, rel]) => ({
      key: relKey,
      label: rel.label,
      cardinality: rel.cardinality,
      fields: rel.fields.map((f) => ({ key: f.key, label: f.label, type: f.type })),
    })),
  }))
}
