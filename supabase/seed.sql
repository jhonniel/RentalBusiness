-- Development seed only. Do not run against production.
-- Requires Phase 1 and Phase 2 migrations.
-- Development admin (confirmed): admin@jryrentals.local / JryAdmin!dev

do $$
declare
  admin_id constant uuid := '11111111-1111-4111-8111-111111111111';
  admin_email constant text := 'admin@jryrentals.local';
  admin_password constant text := 'JryAdmin!dev';
  existing_id uuid;
begin
  select id into existing_id
  from auth.users
  where email = admin_email;

  if existing_id is null then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      admin_email,
      extensions.crypt(admin_password, extensions.gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"JRY","last_name":"Admin","privacy_policy_version":"JRY-PRIVACY-v1.0","terms_version":"JRY-TC-v1.0"}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now()),
      '',
      '',
      '',
      ''
    );
    existing_id := admin_id;
  else
    update auth.users
    set
      encrypted_password = extensions.crypt(admin_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"first_name":"JRY","last_name":"Admin"}'::jsonb
    where id = existing_id;
  end if;

  if not exists (
    select 1
    from auth.identities
    where user_id = existing_id
      and provider = 'email'
  ) then
    insert into auth.identities (
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      existing_id,
      existing_id::text,
      jsonb_build_object(
        'sub', existing_id::text,
        'email', admin_email,
        'email_verified', true
      ),
      'email',
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    );
  end if;

  -- handle_new_user inserts role=customer. Role updates are blocked, so replace the row.
  if exists (
    select 1
    from public.profiles
    where user_id = existing_id
      and role = 'admin'
  ) then
    update public.profiles
    set
      first_name = coalesce(nullif(first_name, ''), 'JRY'),
      last_name = coalesce(nullif(last_name, ''), 'Admin'),
      privacy_policy_version = coalesce(privacy_policy_version, 'JRY-PRIVACY-v1.0'),
      terms_version = coalesce(terms_version, 'JRY-TC-v1.0')
    where user_id = existing_id;
  else
    delete from public.profiles
    where user_id = existing_id;

    insert into public.profiles (
      user_id,
      role,
      first_name,
      last_name,
      privacy_policy_version,
      terms_version
    )
    values (
      existing_id,
      'admin',
      'JRY',
      'Admin',
      'JRY-PRIVACY-v1.0',
      'JRY-TC-v1.0'
    );
  end if;
end
$$;

insert into public.product_categories (slug, name, description, sort_order, is_active)
values
  ('starlink', 'Starlink', 'Satellite internet kits for location work.', 10, true),
  ('cameras', 'Cameras', 'Cinema and mirrorless camera bodies.', 20, true),
  ('drones', 'Drones', 'Aerial imaging platforms.', 30, true),
  ('lenses', 'Lenses', 'Prime and zoom glass.', 40, true),
  ('accessories', 'Accessories', 'Batteries, cards, cages, and support.', 50, true),
  ('lighting', 'Lighting', 'LED fixtures and modifiers.', 60, true),
  ('audio', 'Audio', 'Microphones and recorders.', 70, true),
  ('other', 'Other', 'Additional rental equipment.', 80, true)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.products (
  slug,
  sku,
  category_id,
  name,
  description,
  short_description,
  daily_price,
  weekly_price,
  monthly_price,
  deposit_amount,
  late_fee,
  replacement_value,
  quantity,
  status,
  condition,
  specifications,
  included_accessories,
  rental_rules,
  is_featured
)
values
  (
    'starlink-mini',
    'SL-MINI-001',
    (select id from public.product_categories where slug = 'starlink'),
    'Starlink Mini',
    'Compact Starlink kit for remote sets and events. Includes stand and power supply.',
    'Portable satellite internet for location work.',
    1500,
    9000,
    28000,
    8000,
    500,
    35000,
    5,
    'active',
    'excellent',
    '{"downlink": "up to 100 Mbps", "power": "AC / 12V"}'::jsonb,
    '["Pipe adapter", "Power supply", "Carry case"]'::jsonb,
    'Return with all cables. Weather cover required in rain.',
    true
  ),
  (
    'sony-a7-iv',
    'CAM-A7IV-001',
    (select id from public.product_categories where slug = 'cameras'),
    'Sony A7 IV',
    'Full-frame hybrid body for photo and video production.',
    'Full-frame 33MP hybrid camera.',
    3500,
    20000,
    65000,
    20000,
    1000,
    145000,
    3,
    'active',
    'excellent',
    '{"sensor": "33MP full-frame", "video": "4K60"}'::jsonb,
    '["Battery x2", "Charger", "Strap"]'::jsonb,
    'Do not update firmware without approval.',
    true
  ),
  (
    'dji-air-3',
    'DRN-AIR3-001',
    (select id from public.product_categories where slug = 'drones'),
    'DJI Air 3',
    'Dual-camera drone for documentary and real-estate work.',
    'Foldable dual-camera drone.',
    2800,
    16000,
    52000,
    15000,
    800,
    85000,
    2,
    'active',
    'good',
    '{"flight_time": "46 min", "cameras": "wide + 3x"}'::jsonb,
    '["Batteries x3", "RC", "ND set"]'::jsonb,
    'Pilot is responsible for airspace compliance.',
    true
  )
on conflict (sku) do nothing;

insert into public.equipment_assets (
  product_id,
  asset_code,
  serial_number,
  condition,
  status,
  purchase_cost,
  purchase_date,
  replacement_value
)
values
  (
    (select id from public.products where sku = 'CAM-A7IV-001'),
    'CAM-0001',
    'A7IV-DEV-0001',
    'excellent',
    'available',
    145000,
    '2025-03-12',
    145000
  ),
  (
    (select id from public.products where sku = 'CAM-A7IV-001'),
    'CAM-0002',
    'A7IV-DEV-0002',
    'excellent',
    'available',
    145000,
    '2025-06-02',
    145000
  ),
  (
    (select id from public.products where sku = 'SL-MINI-001'),
    'SLK-0001',
    'SL-MINI-DEV-0001',
    'good',
    'available',
    35000,
    '2025-01-15',
    35000
  )
on conflict (asset_code) do nothing;

update public.waiver_versions
set is_current = false
where is_current = true
  and version is distinct from 'JRY-WAIVER-v1.1';

insert into public.waiver_versions (version, title, body, is_current, published_at)
values (
  'JRY-WAIVER-v1.1',
  'Equipment Rental Agreement & Liability Waiver',
  $waiver$
JRY RENTALS
EQUIPMENT RENTAL AGREEMENT & LIABILITY WAIVER

Business: JRY Rentals
Tagline: Rent. Create. Explore.
Agreement version: JRY-WAIVER-v1.1

This Equipment Rental Agreement and Liability Waiver (“Agreement”) is entered into between JRY Rentals (“Rental Provider”) and the individual or organization renting the equipment (“Renter”).

By completing a rental booking and selecting “I Agree”, the Renter confirms that they have read, understood, and accepted the terms below.

Renter name, contact details, booking / rental ID, rental start, and rental return are taken from the booking record at the time of acceptance.

1. RENTER INFORMATION
The Renter’s full name, email address, mobile number, booking / rental ID, rental start date, and rental return date are the details recorded on the rental request. The Renter confirms those details are accurate.

2. RENTAL EQUIPMENT
The Renter agrees to use and return the equipment listed in their booking, including quantities and the condition recorded for that order.

Equipment on this rental:
{{RENTAL_EQUIPMENT}}

The exact equipment included in the Renter’s booking will be recorded in the rental order, including the applicable security deposit, late fee, and replacement value for that equipment.

3. RESPONSIBILITY FOR EQUIPMENT
The Renter acknowledges that the equipment remains the property of JRY Rentals at all times.

The Renter agrees to:
- Take reasonable care of all rented equipment.
- Use the equipment only for its intended purpose.
- Follow manufacturer instructions and safety requirements.
- Keep equipment secure during the entire rental period.
- Prevent unauthorized persons from using the equipment.
- Immediately report loss, damage, malfunction, or theft to JRY Rentals.
- Return all equipment and accessories included in the booking.

The Renter may not sell, lend, sub-rent, modify, disassemble, or transfer the equipment to another person without written permission from JRY Rentals.

4. EQUIPMENT CONDITION
Before releasing the equipment, JRY Rentals may document its condition through photographs, videos, equipment checklists, serial numbers, accessories checklists, and condition reports.

The Renter is responsible for inspecting the equipment upon receiving it.

If the Renter discovers any existing damage or missing accessory, they must report it to JRY Rentals before using the equipment.

Failure to report pre-existing damage may result in the Renter being considered responsible for the damage.

5. LOSS, DAMAGE, OR THEFT
The Renter is financially responsible for equipment that is lost, stolen, destroyed, or damaged beyond normal wear and tear while in their possession or under their responsibility.

Depending on the circumstances, charges may include:
- Repair Cost: actual reasonable repair cost
- Replacement Cost: the reasonable replacement value of the equipment or component
- Missing Accessories: actual replacement cost
- Data Recovery: reasonable recovery costs where applicable

JRY Rentals will provide the Renter with an itemized explanation of applicable charges.

Normal wear and tear resulting from proper use will not be treated as damage.

6. WATER, WEATHER, AND ENVIRONMENTAL DAMAGE
The Renter understands that rental equipment may be sensitive to water, rain, moisture, sand, dust, extreme heat, extreme cold, saltwater, physical impact, and improper storage.

The Renter agrees to use reasonable precautions to protect the equipment from environmental damage.

Unless specifically stated otherwise for a particular product, the Renter should not assume that equipment is waterproof or weatherproof.

7. DRONE RENTAL
If the Renter rents a drone, the Renter agrees to operate it responsibly and in accordance with applicable laws, regulations, safety requirements, and manufacturer instructions.

The Renter is responsible for determining whether they are legally permitted to fly the drone at the intended location.

The Renter must not intentionally operate the drone:
- In prohibited or restricted areas
- In a dangerous manner
- In a manner that endangers people or property
- Beyond conditions suitable for safe operation
- While impaired by alcohol, drugs, or other substances
- In violation of applicable aviation or privacy laws

The Renter assumes responsibility for damage resulting from negligent, reckless, unauthorized, or improper operation.

JRY Rentals does not guarantee that a particular location is legally or operationally suitable for drone flights. The Renter is responsible for checking applicable restrictions before flying.

8. STARLINK MINI
For Starlink Mini rentals, the Renter agrees to:
- Handle the equipment carefully.
- Protect the equipment from unnecessary physical damage.
- Use the equipment according to applicable manufacturer instructions.
- Keep the equipment secure while traveling.
- Return all components supplied with the rental.

The Renter understands that internet performance may vary depending on location, weather, network conditions, obstructions, service availability, and other factors outside JRY Rentals’ control.

JRY Rentals does not guarantee a particular internet speed, uptime, or service availability.

9. CAMERA EQUIPMENT
For camera equipment, including the DJI Osmo 360, the Renter agrees to:
- Protect the camera and accessories from physical damage.
- Use appropriate mounting equipment.
- Keep the equipment secure during transportation.
- Avoid exposing the equipment to conditions outside its rated operating limits.
- Return all supplied accessories.

The Renter is responsible for physical damage caused by improper handling, impact, water exposure, loss, theft, or negligent use.

10. PERSONAL DATA AND RECORDED CONTENT
The Renter understands that cameras and other recording equipment may capture photographs, videos, audio, location information, or other data.

The Renter is solely responsible for ensuring that their use of the equipment complies with applicable privacy, recording, copyright, and other laws.

JRY Rentals is not responsible for claims arising from content recorded or created by the Renter.

11. PERSONAL INJURY AND PROPERTY DAMAGE
The Renter agrees to use the equipment safely and responsibly.

To the extent permitted by applicable law, the Renter assumes responsibility for injuries, property damage, or other losses resulting from the Renter’s negligent, reckless, unauthorized, or improper use of the equipment.

Nothing in this Agreement is intended to exclude liability that cannot legally be excluded under applicable law.

12. THIRD-PARTY USE
The Renter must not allow another person to use the rented equipment unless expressly authorized by JRY Rentals.

If another person is authorized to use the equipment, the Renter remains responsible for the equipment and for ensuring that the authorized user follows this Agreement.

13. RETURN OF EQUIPMENT
The Renter agrees to return the equipment:
- On or before the agreed return date and time.
- At the agreed return location or through the agreed delivery, meetup, or collection method.
- With all accessories and components.
- In substantially the same condition in which it was received, excluding normal wear and tear.

Late returns may result in additional rental charges.

If a late return prevents JRY Rentals from fulfilling another confirmed booking, the Renter may also be responsible for reasonable resulting costs, subject to applicable law and the rental terms.

14. LATE RETURN
If equipment is not returned on time, JRY Rentals may charge additional rental fees according to the applicable rental rate and booking terms.

The Renter agrees to communicate with JRY Rentals as soon as possible if a delay is expected.

Failure to return equipment may be treated as a serious breach of this Agreement.

15. RENTAL PAYMENT
The Renter agrees to pay all applicable rental fees, delivery fees, extension fees, late fees, damage charges, replacement charges, and other charges clearly stated in the booking.

All applicable charges will be presented to the Renter through the rental system or communicated by JRY Rentals.

The amount paid to confirm this rental is the down payment / booking payment.

16. DOWN PAYMENT AND REFUND
The down payment is not refundable once the Renter has booked the rental.

A rental is booked for this purpose when the Renter submits the rental request and the booking is recorded by JRY Rentals.

After that point, the down payment stays with JRY Rentals if the Renter cancels, changes dates, fails to complete remaining payment, or does not collect the equipment, except where a refund is required by applicable Philippine consumer law.

The down payment is separate from any security deposit. A security deposit, if required, is not the down payment.

17. SECURITY DEPOSIT
Where applicable, JRY Rentals may require a security deposit before releasing equipment.

The security deposit may be used toward legitimate charges resulting from damage, loss, missing accessories, theft, excessive cleaning, late return, or other agreed rental obligations.

Any remaining refundable amount will be handled according to JRY Rentals’ applicable deposit policy.

18. EQUIPMENT MALFUNCTION
If equipment malfunctions during a rental through no fault of the Renter, the Renter must notify JRY Rentals as soon as reasonably possible.

The Renter must not attempt unauthorized repairs or modifications.

JRY Rentals may, depending on circumstances, troubleshoot the issue, provide replacement equipment where available, provide a reasonable alternative, adjust the rental arrangement, or provide another appropriate remedy.

JRY Rentals does not guarantee uninterrupted operation of rented equipment.

19. PROHIBITED USE
The equipment must not be used for illegal, dangerous, abusive, or unauthorized activities.

The Renter must not:
- Intentionally damage equipment
- Modify equipment
- Remove serial numbers or identifying marks
- Attempt unauthorized repairs
- Use equipment for unlawful activities
- Sub-rent the equipment
- Use equipment in a reckless manner
- Conceal loss or damage

20. CANCELLATION
The Renter may request cancellation through JRY Rentals after booking. Cancellation does not refund the down payment.

The down payment remains non-refundable after the rental is booked, as stated in the Down Payment and Refund section of this Agreement.

Any remaining unpaid rental balance may still be due if the cancellation occurs after the rental period has started or as otherwise presented during booking.

21. FORCE MAJEURE
JRY Rentals will not be responsible for delays or inability to provide services caused by circumstances reasonably beyond its control, including severe weather, natural disasters, government restrictions, major network outages, transportation disruptions, or other extraordinary events.

Where appropriate, JRY Rentals may offer rescheduling, replacement, refund, credit, or another reasonable solution.

22. LIMITATION OF LIABILITY
To the extent permitted by applicable law, JRY Rentals’ liability arising from a rental will be limited to the remedies and amounts applicable to the particular rental transaction.

Nothing in this Agreement shall be interpreted as waiving rights or liabilities that cannot legally be waived.

23. ACKNOWLEDGMENT OF RISK
The Renter acknowledges that certain equipment may involve inherent risks when used improperly or in unsuitable environments.

The Renter confirms that they have sufficient knowledge and ability to safely operate the equipment they are renting or will follow appropriate manufacturer instructions and safety guidance.

The Renter accepts responsibility for their own actions and the actions of anyone they authorize to use the equipment.

24. ELECTRONIC AGREEMENT
The Renter agrees that electronic acceptance of this Agreement through the JRY Rentals website or application constitutes their acknowledgment and acceptance of these terms.

The following information may be recorded: renter name, rental ID, agreement version, date and time of acceptance, IP address, user/account ID, digital signature or acceptance record, and equipment associated with the agreement.

JRY Rentals may retain the acceptance record for rental, accounting, dispute-resolution, and legal purposes, subject to applicable privacy laws.

25. ENTIRE AGREEMENT
This Agreement, together with the applicable booking details, rental pricing, cancellation policy, equipment condition report, and other terms presented during the booking process, constitutes the agreement between the Renter and JRY Rentals regarding the rental.

If a specific booking term conflicts with a general term in this Agreement, the applicable booking-specific term will control to the extent clearly stated.

26. GOVERNING LAW
This Agreement shall be interpreted in accordance with the applicable laws of the Republic of the Philippines, subject to applicable consumer protection, privacy, civil, and other laws and regulations.

Any dispute shall be handled through appropriate lawful means and the appropriate jurisdiction.

27. RENTER ACKNOWLEDGMENT
By accepting this Agreement, the Renter confirms that:
- They have read and understood the JRY Rentals Equipment Rental Agreement & Liability Waiver.
- They agree to take reasonable care of the equipment and return it according to the rental terms.
- They understand they may be financially responsible for loss, theft, or damage caused by negligence, misuse, unauthorized use, or failure to properly care for the equipment.
- They agree to comply with applicable laws and safety requirements when using the equipment.
- The information provided for this rental is accurate.
- They agree to the JRY Rentals Privacy Policy and Terms & Conditions.
- They understand that the down payment is not refundable once the rental is booked.

This version is stored with the Renter’s acceptance and will not be altered after they sign.
$waiver$,
  true,
  timezone('utc', now())
)
on conflict (version) do nothing;

update public.waiver_versions
set is_current = false
where version is distinct from 'JRY-WAIVER-v1.1';

update public.waiver_versions
set is_current = true
where version = 'JRY-WAIVER-v1.1';

insert into public.business_profiles (
  name,
  email,
  phone,
  address,
  currency,
  timezone,
  late_fee_policy,
  deposit_rules,
  cancellation_rules
)
select
  'JRY Rentals',
  'jryrentals@gmail.com',
  '+63 2 8000 0000',
  'Davao City, Philippines',
  'PHP',
  'Asia/Manila',
  'Late returns are charged per day using the product late fee.',
  'A refundable deposit is authorized at checkout and released after inspection.',
  'The down payment is not refundable once a rental is booked.'
where not exists (
  select 1 from public.business_profiles
);

insert into public.settings (key, value)
values
  ('late_fee_policy', '{"unit": "day", "grace_hours": 2}'::jsonb),
  ('deposit_rules', '{"required": true}'::jsonb),
  ('cancellation_rules', '{"free_until_hours": 48}'::jsonb),
  ('email_settings', '{"timezone": "Asia/Manila"}'::jsonb)
on conflict (key) do nothing;

insert into public.recurring_expenses (
  name,
  category,
  amount,
  frequency,
  interval_count,
  anchor_day,
  start_on,
  next_occurrence_on,
  vendor,
  status,
  notes
)
select
  'Starlink subscription',
  'subscription',
  2500,
  'monthly',
  1,
  15,
  '2026-01-15',
  '2026-10-15',
  'Starlink',
  'active',
  'Due every 15th. Generated by Phase 12 cron, not a browser timer.'
where not exists (
  select 1
  from public.recurring_expenses
  where name = 'Starlink subscription'
    and vendor = 'Starlink'
);

insert into public.expenses (
  name,
  category,
  description,
  amount,
  vendor,
  reference,
  status,
  incurred_on,
  notes
)
select
  'Camera sensor cleaning',
  'maintenance',
  'Sensor clean for A7 IV bodies.',
  1800,
  'Metro Camera Care',
  'MCC-2026-091',
  'paid',
  '2026-09-01',
  'Development seed expense.'
where not exists (
  select 1
  from public.expenses
  where reference = 'MCC-2026-091'
);
