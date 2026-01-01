-- Seed initial events for Vortex Athletics
-- This migration populates the events table with the original events

-- Christmas Camp
INSERT INTO events (
  event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details
) VALUES (
  'Christmas Camp',
  'Celebrate the holidays with our exciting Christmas Camp! This week-long adventure combines gymnastics fundamentals, ninja obstacle training, and athletic development activities.',
  'Celebrate the holidays with our exciting Christmas Camp! This week-long adventure combines gymnastics fundamentals, ninja obstacle training, and athletic development activities. Perfect for keeping kids active and engaged during the holiday break while building strength, coordination, and confidence. Our experienced coaches will guide athletes through fun, age-appropriate challenges that make learning feel like play.',
  '2026-12-20',
  '2026-12-28',
  'camp',
  'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
  '[
    {"date": "2026-12-20", "startTime": "9:00 AM", "endTime": "3:00 PM"},
    {"date": "2026-12-21", "startTime": "9:00 AM", "endTime": "3:00 PM"},
    {"date": "2026-12-22", "startTime": "9:00 AM", "endTime": "3:00 PM"},
    {"date": "2026-12-23", "startTime": "9:00 AM", "endTime": "3:00 PM"},
    {"date": "2026-12-24", "startTime": "9:00 AM", "endTime": "12:00 PM", "description": "Half day - Holiday Eve"},
    {"date": "2026-12-26", "startTime": "9:00 AM", "endTime": "3:00 PM"},
    {"date": "2026-12-27", "startTime": "9:00 AM", "endTime": "3:00 PM"},
    {"date": "2026-12-28", "startTime": "9:00 AM", "endTime": "3:00 PM"}
  ]'::jsonb,
  '[
    "Ages 5-18 welcome - grouped by age and skill level",
    "Includes healthy lunch and afternoon snacks",
    "Early drop-off (8:00 AM) and late pick-up (4:00 PM) available",
    "Holiday-themed activities and games",
    "Progress tracking through Athleticism Accelerator™",
    "Take-home camp certificate and progress report"
  ]'::jsonb
);

-- NCAA College Football National Championship Watch Party
INSERT INTO events (
  event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details
) VALUES (
  'NCAA College Football National Championship Watch Party',
  'Join the Vortex community for the biggest game in college football! Watch the NCAA College Football National Championship Game on our big screen.',
  'Join the Vortex community for the biggest game in college football! Watch the NCAA College Football National Championship Game on our big screen as we cheer on the nation''s top collegiate teams competing for the national title. This is a perfect opportunity to come together as a community, enjoy great food and company, and experience the excitement of championship football. Bring the whole family for an evening of fun, community, and gridiron action!',
  '2026-01-19',
  NULL,
  'watch-party',
  'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
  '[
    {"date": "2026-01-19", "startTime": "6:00 PM", "endTime": "10:00 PM", "description": "Pre-game coverage starts at 6:00 PM, kickoff at 7:00 PM"}
  ]'::jsonb,
  '[
    "All ages welcome - family-friendly event",
    "Complimentary pizza, snacks, and beverages",
    "Raffle prizes throughout the evening",
    "Game day atmosphere with large screen viewing",
    "Meet and connect with other Vortex families",
    "Free event - no registration required"
  ]'::jsonb
);

-- International Gymnastics Camp
INSERT INTO events (
  event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details
) VALUES (
  'International Gymnastics Camp',
  'Experience world-class training at our International Gymnastics Camp! This intensive 6-day camp brings together elite coaches from international programs.',
  'Experience world-class training at our International Gymnastics Camp! This intensive 6-day camp brings together elite coaches from international programs to share advanced techniques, training methodologies, and competitive strategies. Designed for competitive team members and advanced athletes, this camp focuses on skill refinement, routine construction, mental preparation, and performance optimization. Athletes will receive personalized feedback, video analysis, and training plans to elevate their competitive performance.',
  '2026-01-15',
  '2026-01-20',
  'camp',
  'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
  '[
    {"date": "2026-01-15", "startTime": "8:00 AM", "endTime": "5:00 PM", "description": "Day 1 - Orientation & Assessment"},
    {"date": "2026-01-16", "description": "All day training", "allDay": true},
    {"date": "2026-01-17", "description": "All day training", "allDay": true},
    {"date": "2026-01-18", "description": "All day training", "allDay": true},
    {"date": "2026-01-19", "description": "All day training", "allDay": true},
    {"date": "2026-01-20", "startTime": "8:00 AM", "endTime": "2:00 PM", "description": "Final day - Showcase & Evaluations"}
  ]'::jsonb,
  '[
    "Guest coaches from top international programs",
    "Comprehensive skill assessments and video analysis",
    "Personalized training plans and feedback",
    "Routine construction and choreography workshops",
    "Mental training and competition preparation",
    "For competitive team members and advanced athletes (evaluation required)",
    "Limited spots available - early registration recommended"
  ]'::jsonb
);

-- Superbowl Watch Party
INSERT INTO events (
  event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details
) VALUES (
  'Superbowl Watch Party',
  'Get ready for the biggest game of the year! Join the Vortex family for our annual Superbowl Watch Party.',
  'Get ready for the biggest game of the year! Join the Vortex family for our annual Superbowl Watch Party. We''ll transform our main gym into the ultimate viewing experience with a large screen, comfortable seating, and game day atmosphere. This is a great opportunity to relax, have fun, and connect with the Vortex community while watching the championship game. Whether you''re a football fan or just here for the snacks and company, everyone is welcome!',
  '2026-02-08',
  NULL,
  'watch-party',
  'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
  '[]'::jsonb,
  '[
    "6:00 PM kickoff (pre-game coverage starts earlier)",
    "Game day snacks, pizza, and beverages provided",
    "Family-friendly environment - all ages welcome",
    "Raffle prizes and halftime games",
    "Comfortable viewing area with seating",
    "Free event for Vortex athletes and families",
    "RSVP recommended for planning purposes"
  ]'::jsonb
);

-- Athleticism Accelerator and Vortex Ninja Classes Begin
INSERT INTO events (
  event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details
) VALUES (
  'Athleticism Accelerator and Vortex Ninja Classes Begin',
  'The wait is over! Our highly anticipated Athleticism Accelerator and Vortex Ninja programs officially launch on February 15th.',
  'The wait is over! Our highly anticipated Athleticism Accelerator and Vortex Ninja programs officially launch on February 15th. These programs combine cutting-edge athletic development with fun, engaging training that builds strength, agility, coordination, and confidence. The Athleticism Accelerator focuses on the 8 Tenets of Athleticism through science-backed training methods, while Vortex Ninja offers obstacle-based training that develops functional movement and body control. Both programs integrate seamlessly with our gymnastics foundation to create complete athletes.',
  '2026-02-15',
  NULL,
  'class',
  'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
  '[]'::jsonb,
  '[
    "New class schedules and times available now",
    "Open enrollment for all skill levels - beginner to advanced",
    "Free trial classes available - experience before you commit",
    "Small group sizes for personalized attention",
    "Technology-integrated training with real-time feedback",
    "Progress tracking through Athleticism Accelerator™ system",
    "Flexible scheduling options available",
    "Contact us to register or schedule a free trial class"
  ]'::jsonb
);

-- Winter Showcase & Evaluations
INSERT INTO events (
  event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details
) VALUES (
  'Winter Showcase & Evaluations',
  'Join us for our Winter Showcase, celebrating three months of growth and achievement!',
  'Join us for our Winter Showcase, celebrating three months of growth and achievement! This special event provides parents with the opportunity to see firsthand the learning and improvement their athletes have made during the winter season (December, January, and February). Athletes will demonstrate their skills and progress through routines and skill demonstrations. Additionally, our coaches will conduct internal evaluations for all athletes to determine level advancement or identify areas needing additional development time.',
  '2026-02-28',
  NULL,
  'event',
  'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
  '[]'::jsonb,
  '[
    "Athlete skill demonstrations and routines",
    "Parent viewing of athlete progress and achievements",
    "Internal evaluations for level advancement decisions",
    "Individual progress reports and feedback",
    "Celebration of winter season accomplishments",
    "All program participants welcome",
    "Schedule and timing details to be announced"
  ]'::jsonb
);

-- Spring Showcase & Evaluations
INSERT INTO events (
  event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details
) VALUES (
  'Spring Showcase & Evaluations',
  'Celebrate the spring season at our Spring Showcase! This quarterly event showcases the incredible progress athletes have made.',
  'Celebrate the spring season at our Spring Showcase! This quarterly event showcases the incredible progress athletes have made during the spring months (March, April, and May). Parents will witness their athletes'' growth through skill demonstrations, routine performances, and progress presentations. Our coaching team will conduct comprehensive evaluations to assess each athlete''s readiness for level advancement, ensuring appropriate placement and continued development.',
  '2026-05-30',
  NULL,
  'event',
  'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
  '[]'::jsonb,
  '[
    "Spring season progress demonstrations",
    "Parent viewing of athlete achievements and skill development",
    "Comprehensive athlete evaluations for level placement",
    "Individualized feedback and progress assessments",
    "Recognition of spring season accomplishments",
    "All program levels and ages participate",
    "Schedule and timing details to be announced"
  ]'::jsonb
);

-- Summer Showcase & Evaluations
INSERT INTO events (
  event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details
) VALUES (
  'Summer Showcase & Evaluations',
  'Showcase the summer season''s achievements at our Summer Showcase!',
  'Showcase the summer season''s achievements at our Summer Showcase! This event highlights the dedication and progress athletes have shown throughout the summer months (June, July, and August). Parents will see their athletes demonstrate new skills, improved techniques, and overall growth. Our coaching staff will perform detailed evaluations to determine each athlete''s progression path, identifying those ready to advance to the next level and those who would benefit from additional time at their current level.',
  '2026-08-29',
  NULL,
  'event',
  'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
  '[]'::jsonb,
  '[
    "Summer season skill demonstrations and routines",
    "Parent viewing of athlete learning and improvement",
    "Detailed evaluations for level advancement decisions",
    "Progress reports and personalized feedback",
    "Celebration of summer achievements",
    "All athletes participate in showcase",
    "Schedule and timing details to be announced"
  ]'::jsonb
);

-- Autumn/Fall Showcase & Evaluations
INSERT INTO events (
  event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details
) VALUES (
  'Autumn/Fall Showcase & Evaluations',
  'Close out the year with our Autumn/Fall Showcase! This final showcase of the year celebrates the growth and achievements athletes have accomplished.',
  'Close out the year with our Autumn/Fall Showcase! This final showcase of the year celebrates the growth and achievements athletes have accomplished during the fall season (September, October, and November). Parents will have the opportunity to see their athletes'' progress through comprehensive skill demonstrations and routine performances. Our coaches will conduct year-end evaluations to assess readiness for level advancement, ensuring each athlete is placed appropriately for continued success in the coming year.',
  '2026-11-28',
  NULL,
  'event',
  'Vortex Athletics, 4961 Tesla Dr, Bowie, MD 20715',
  '[]'::jsonb,
  '[
    "Fall season progress demonstrations and performances",
    "Parent viewing of athlete learning and improvement",
    "Year-end evaluations for level advancement",
    "Comprehensive progress reports and assessments",
    "Celebration of fall season and annual achievements",
    "All program participants showcase their progress",
    "Schedule and timing details to be announced"
  ]'::jsonb
);

