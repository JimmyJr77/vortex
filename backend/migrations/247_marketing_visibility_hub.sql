CREATE TABLE IF NOT EXISTS marketing_channels (
  id BIGSERIAL PRIMARY KEY,
  key VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(60) NOT NULL,
  description TEXT,
  website_url TEXT,
  account_url TEXT,
  username VARCHAR(255),
  owner_name VARCHAR(160),
  status VARCHAR(30) NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'planned', 'in_progress', 'active', 'needs_attention', 'paused')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  settings JSONB NOT NULL DEFAULT '{}',
  inputs JSONB NOT NULL DEFAULT '{}',
  secret_refs JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  last_verified_at TIMESTAMPTZ,
  next_review_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_channels_category ON marketing_channels(category);
CREATE INDEX IF NOT EXISTS idx_marketing_channels_status ON marketing_channels(status);

CREATE TABLE IF NOT EXISTS marketing_publish_revisions (
  id BIGSERIAL PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'implemented', 'cancelled')),
  channel_count INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  implemented_at TIMESTAMPTZ
);

ALTER TABLE marketing_publish_revisions DROP CONSTRAINT IF EXISTS marketing_publish_revisions_status_check;
ALTER TABLE marketing_publish_revisions ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE marketing_publish_revisions
  ADD CONSTRAINT marketing_publish_revisions_status_check
  CHECK (status IN ('draft', 'ready', 'implemented', 'cancelled'));

INSERT INTO permission (key, description)
VALUES ('marketing.manage', 'Create, update, and package marketing visibility configuration.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM role
JOIN permission ON permission.key = 'marketing.manage'
WHERE role.key IN ('MASTER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO marketing_channels
  (key, name, category, description, website_url, status, priority, settings, inputs)
VALUES
  ('google-business-profile', 'Google Business Profile', 'Local search & maps', 'Local presence across Google Search and Maps; reviews, hours, services, photos, and posts.', 'https://business.google.com/', 'in_progress', 'critical', '{"reviews_enabled":true,"messaging_enabled":false}', '{"business_name":"","address":"","phone":"","hours":"","categories":[],"service_area":[],"description":""}'),
  ('google-search-console', 'Google Search Console', 'Search & discovery', 'Indexing, search performance, sitemaps, page experience, and technical search visibility.', 'https://search.google.com/search-console', 'in_progress', 'critical', '{"sitemap_submitted":false,"domain_verified":false}', '{"property_url":"","verification_method":"","sitemap_url":""}'),
  ('google-analytics', 'Google Analytics 4', 'Analytics & measurement', 'Web and campaign measurement with conversion events and consent-aware attribution.', 'https://analytics.google.com/', 'active', 'critical', '{"consent_mode":true,"internal_traffic_filtered":true}', '{"property_id":"","measurement_ids":[],"key_events":[]}'),
  ('google-ads', 'Google Ads', 'Paid acquisition', 'Search, local, display, and remarketing campaigns.', 'https://ads.google.com/', 'planned', 'high', '{"auto_tagging":true,"remarketing":false}', '{"customer_id":"","conversion_actions":[],"monthly_budget":""}'),
  ('bing-places', 'Bing Places for Business', 'Local search & maps', 'Local listing surfaced in Bing search and Microsoft experiences.', 'https://www.bingplaces.com/', 'planned', 'high', '{}', '{"business_name":"","address":"","phone":"","hours":"","categories":[]}'),
  ('bing-webmaster-tools', 'Bing Webmaster Tools', 'Search & discovery', 'Bing indexing, sitemap, crawl, and search performance management.', 'https://www.bing.com/webmasters/', 'planned', 'medium', '{"sitemap_submitted":false}', '{"site_url":"","verification_method":"","sitemap_url":""}'),
  ('apple-business-connect', 'Apple Business Connect', 'Local search & maps', 'Place card visibility in Apple Maps, Siri, Wallet, and related Apple surfaces.', 'https://businessconnect.apple.com/', 'planned', 'high', '{}', '{"company_id":"","location_id":"","business_name":"","address":"","phone":"","hours":""}'),
  ('yelp-business', 'Yelp for Business', 'Directories & reviews', 'Business information, photos, categories, reviews, and local discovery.', 'https://business.yelp.com/', 'planned', 'medium', '{"review_notifications":true}', '{"business_page_url":"","business_name":"","address":"","phone":"","hours":""}'),
  ('facebook', 'Facebook', 'Social media', 'Community updates, events, local reach, messages, and paid social.', 'https://www.facebook.com/business', 'planned', 'high', '{"messages_enabled":true}', '{"page_id":"","page_name":"","handle":"","bio":"","website_url":""}'),
  ('instagram', 'Instagram', 'Social media', 'Visual proof, coaching stories, athlete highlights, reels, and community engagement.', 'https://www.instagram.com/', 'planned', 'high', '{}', '{"handle":"","bio":"","website_url":"","content_pillars":[]}'),
  ('youtube', 'YouTube', 'Video & content', 'Long-form instruction, facility tours, athlete stories, shorts, and search discovery.', 'https://www.youtube.com/', 'in_progress', 'high', '{}', '{"channel_id":"","handle":"","channel_url":"","description":""}'),
  ('tiktok', 'TikTok', 'Social media', 'Short-form discovery, training education, culture, and local awareness.', 'https://www.tiktok.com/business/', 'planned', 'medium', '{}', '{"handle":"","bio":"","website_url":""}'),
  ('nextdoor', 'Nextdoor Business', 'Community & partnerships', 'Neighborhood recommendations, local posts, and nearby family discovery.', 'https://business.nextdoor.com/', 'planned', 'medium', '{}', '{"page_url":"","business_name":"","service_area":[]}'),
  ('school-outreach', 'School Outreach', 'Schools & youth organizations', 'Direct relationships with schools, PTOs, counselors, coaches, and after-school coordinators.', NULL, 'in_progress', 'critical', '{"follow_up_days":7}', '{"target_schools":[],"contact_roles":[],"offer":"","outreach_template":"","tracking_tags":[]}'),
  ('youth-organizations', 'Youth Organization Partnerships', 'Schools & youth organizations', 'Partnerships with recreation departments, clubs, homeschool groups, camps, and youth nonprofits.', NULL, 'planned', 'high', '{}', '{"target_organizations":[],"contact_roles":[],"partnership_offer":""}'),
  ('email-marketing', 'Email Marketing', 'Owned audience', 'Lead nurture, newsletters, program announcements, re-engagement, and operational segmentation.', NULL, 'in_progress', 'critical', '{"double_opt_in":false,"unsubscribe_enabled":true}', '{"provider":"","sender_name":"","sender_email":"","audiences":[],"automations":[]}'),
  ('local-pr', 'Local PR & Media', 'Community & partnerships', 'Local news, calendars, parenting publications, radio, and community storytelling.', NULL, 'planned', 'medium', '{}', '{"media_list":[],"story_angles":[],"press_kit_url":""}'),
  ('referral-program', 'Member Referral Program', 'Referral & reputation', 'Structured member advocacy with trackable offers and follow-up.', NULL, 'planned', 'high', '{}', '{"offer":"","referrer_reward":"","referred_reward":"","tracking_method":""}'),
  ('review-management', 'Review Management', 'Referral & reputation', 'Review requests, response standards, escalation, and reputation monitoring across platforms.', NULL, 'planned', 'critical', '{"response_sla_hours":48}', '{"request_template":"","response_owner":"","platforms":[],"escalation_rules":[]}'),
  ('schema-markup', 'LocalBusiness & Program Schema', 'Search & discovery', 'Structured data for organization, local business, programs, events, and FAQs.', 'https://schema.org/', 'in_progress', 'high', '{}', '{"organization_name":"","logo_url":"","same_as":[],"schema_types":[]}'),
  ('directories', 'Local & Sports Directories', 'Directories & reviews', 'Consistent listings in chambers, recreation guides, sports directories, and local family resources.', NULL, 'planned', 'medium', '{}', '{"directories":[],"canonical_name":"","canonical_address":"","canonical_phone":""}')
ON CONFLICT (key) DO NOTHING;

-- Public, verified business facts are safe to keep synchronized. Provider account
-- IDs, verification state, credentials, and internal ownership remain operator-entered.
UPDATE marketing_channels SET
  inputs = inputs || jsonb_build_object(
    'business_name', 'Vortex Athletics',
    'address', '4961 Tesla Dr, Ste E, Bowie, MD 20715',
    'phone', '+1-443-422-4794',
    'hours', 'Mon-Fri 4:00-8:30 PM; Sat 9:00 AM-12:00 PM; Sun closed',
    'categories', jsonb_build_array('Gymnastics center', 'Youth organization', 'Physical fitness program'),
    'service_area', jsonb_build_array('Bowie', 'Crofton', 'Mitchellville', 'Upper Marlboro', 'Annapolis', 'Prince George''s County', 'Anne Arundel County'),
    'description', 'Vortex Athletics is a gymnastics and youth athletic-development center in Bowie, Maryland offering preschool and youth gymnastics, tumbling, ninja obstacle training, homeschool programs, camps, and athletic performance training.'
  )
WHERE key = 'google-business-profile';

UPDATE marketing_channels SET
  inputs = inputs || jsonb_build_object(
    'property_url', 'https://www.vortexathletics.com/',
    'sitemap_url', 'https://www.vortexathletics.com/sitemap.xml'
  )
WHERE key = 'google-search-console';

UPDATE marketing_channels SET
  inputs = inputs || jsonb_build_object(
    'property_id', '539662954',
    'measurement_ids', jsonb_build_array('G-XDE178DQWY'),
    'key_events', jsonb_build_array('generate_lead', 'sign_up', 'initial_enrollment_purchase')
  ),
  settings = settings || jsonb_build_object('gtm_container', 'GTM-T38PSLXX')
WHERE key = 'google-analytics';

UPDATE marketing_channels SET
  account_url = 'https://www.instagram.com/vortexathletics.usa/',
  username = '@vortexathletics.usa',
  inputs = inputs || jsonb_build_object(
    'handle', '@vortexathletics.usa',
    'website_url', 'https://www.vortexathletics.com/',
    'content_pillars', jsonb_build_array('athlete progress', 'coach expertise', 'facility and equipment', 'parent education', 'classes and events')
  )
WHERE key = 'instagram';

UPDATE marketing_channels SET
  account_url = 'https://www.facebook.com/profile.php?id=61585434675018',
  inputs = inputs || jsonb_build_object(
    'page_name', 'Vortex Athletics',
    'website_url', 'https://www.vortexathletics.com/'
  )
WHERE key = 'facebook';

UPDATE marketing_channels SET
  account_url = 'https://www.youtube.com/@VortexAthleticsUSA',
  username = '@VortexAthleticsUSA',
  inputs = inputs || jsonb_build_object(
    'handle', '@VortexAthleticsUSA',
    'channel_url', 'https://www.youtube.com/@VortexAthleticsUSA',
    'description', 'Youth gymnastics, athletic development, ninja training, coaching education, and athlete stories from Vortex Athletics in Bowie, Maryland.'
  )
WHERE key = 'youtube';

UPDATE marketing_channels SET
  inputs = inputs || jsonb_build_object(
    'organization_name', 'Vortex Athletics',
    'logo_url', 'https://www.vortexathletics.com/vortex_logo_1.png',
    'same_as', jsonb_build_array(
      'https://www.instagram.com/vortexathletics.usa/',
      'https://www.facebook.com/profile.php?id=61585434675018',
      'https://www.youtube.com/@VortexAthleticsUSA'
    ),
    'schema_types', jsonb_build_array('Organization', 'SportsActivityLocation', 'Service', 'Event', 'FAQPage', 'BreadcrumbList')
  )
WHERE key = 'schema-markup';

UPDATE marketing_channels SET
  inputs = inputs || jsonb_build_object(
    'canonical_name', 'Vortex Athletics',
    'canonical_address', '4961 Tesla Dr, Ste E, Bowie, MD 20715',
    'canonical_phone', '+1-443-422-4794',
    'directories', jsonb_build_array('Bing Places', 'Apple Business Connect', 'Yelp', 'Nextdoor', 'local chambers', 'parks and recreation guides', 'family activity directories')
  )
WHERE key = 'directories';

UPDATE marketing_channels SET
  inputs = inputs || jsonb_build_object(
    'platforms', jsonb_build_array('Google Business Profile', 'Facebook', 'Yelp'),
    'request_template', 'Thank you for trusting Vortex Athletics with your athlete. If you have a moment, would you share an honest review of your experience? Your feedback helps local families find the right program.',
    'escalation_rules', jsonb_build_array('Respond to every review within 48 hours', 'Never disclose athlete or family details', 'Move safety, billing, or injury concerns to a private owner-led resolution')
  )
WHERE key = 'review-management';
