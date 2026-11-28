import { annualMembershipPurchaseHistorySql } from '../scheduling/annualMembership.js'

// Billing ownership preserves the original family's purchase after a person
// moves households. Unbilled redemptions require an unambiguous household link,
// including former members, so archiving a person cannot reset the family date.
export const familyMemberSinceSql = (familyId, facilityId, today) => `(
  SELECT min((purchase.purchased_at AT TIME ZONE COALESCE(
    (SELECT NULLIF(timezone,'') FROM facility WHERE id=${facilityId}),'America/New_York'))::date)::text
  FROM (${annualMembershipPurchaseHistorySql()}) purchase
  WHERE (purchase.purchased_at AT TIME ZONE COALESCE(
    (SELECT NULLIF(timezone,'') FROM facility WHERE id=${facilityId}),'America/New_York'))::date<=${today}
    AND (EXISTS(SELECT 1 FROM family_billing_account account JOIN family owner ON owner.id=account.family_id
      WHERE account.id=purchase.family_billing_account_id AND owner.id=${familyId} AND owner.facility_id=${facilityId})
      OR (purchase.family_billing_account_id IS NULL AND EXISTS(SELECT 1 FROM member membership_member
        WHERE membership_member.id=purchase.member_id AND membership_member.facility_id=${facilityId}
          AND (EXISTS(SELECT 1 FROM family_member link WHERE link.member_id=membership_member.id AND link.family_id=${familyId}
              AND NOT EXISTS(SELECT 1 FROM family_member other WHERE other.member_id=membership_member.id AND other.family_id<>link.family_id))
            OR (membership_member.family_id=${familyId} AND NOT EXISTS(SELECT 1 FROM family_member link WHERE link.member_id=membership_member.id))))))
)`
