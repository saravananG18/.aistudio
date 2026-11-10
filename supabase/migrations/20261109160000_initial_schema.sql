create table public.profiles (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  role text not null check (role in ('student', 'driver', 'admin')),
  is_verified boolean not null default false,
  student_id_number text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.routes (
  id text primary key,
  route_number integer,
  name text not null,
  ordered_stops jsonb not null default '[]'::jsonb,
  stop_details jsonb
);

create table public.buses (
  id text primary key,
  bus_number text not null unique,
  route_number integer,
  bus_name text not null,
  capacity integer not null check (capacity > 0),
  layout text not null default '2x2',
  is_active boolean not null default true,
  route_id text references public.routes(id) on delete set null
);

create table public.trips (
  id text primary key,
  bus_id text not null references public.buses(id),
  route_id text not null references public.routes(id),
  assigned_driver_id text references public.profiles(id) on delete set null,
  travel_date date not null,
  departure_time text not null,
  departure_time_iso timestamptz,
  booking_window_opens_at timestamptz,
  booking_window_closes_at timestamptz,
  status text not null default 'OPEN'
    check (status in ('NOT YET OPEN', 'OPEN', 'FULL', 'CLOSED', 'DEPARTED', 'COMPLETED')),
  parking_bay text not null default '',
  notes text not null default ''
);

create index trips_travel_date_status_idx on public.trips (travel_date, status);
create index trips_driver_date_idx on public.trips (assigned_driver_id, travel_date);

create table public.student_qr_identities (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  opaque_qr_identifier text not null unique,
  status text not null check (status in ('ACTIVE', 'REVOKED')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  regenerated_at timestamptz
);

create index student_qr_user_status_idx on public.student_qr_identities (user_id, status);

create table public.bookings (
  id text primary key,
  booking_reference text not null unique,
  student_id text not null references public.profiles(id),
  trip_id text not null references public.trips(id),
  seat_id text not null,
  booking_status text not null check (booking_status in ('CONFIRMED', 'CANCELLED')),
  boarding_status text not null default 'NOT BOARDED'
    check (boarding_status in ('NOT BOARDED', 'BOARDED')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create unique index bookings_one_confirmed_seat_idx
  on public.bookings (trip_id, seat_id)
  where booking_status = 'CONFIRMED';
create index bookings_student_trip_idx on public.bookings (student_id, trip_id);

create table public.boarding_events (
  id text primary key,
  booking_id text not null unique references public.bookings(id),
  student_id text not null references public.profiles(id),
  trip_id text not null references public.trips(id),
  scanned_by_driver_id text not null references public.profiles(id),
  boarded_at timestamptz not null default now(),
  method text not null check (method in ('QR', 'MANUAL'))
);

create table public.email_logs (
  id text primary key,
  booking_id text references public.bookings(id) on delete set null,
  recipient_email text not null,
  recipient_name text not null,
  subject text not null,
  body_preview text not null default '',
  status text not null check (status in ('SENT', 'FAILED')),
  sent_at timestamptz not null default now(),
  error_message text
);

create table public.system_settings (
  id boolean primary key default true check (id),
  restrict_email_domain boolean not null default false,
  allowed_domain text not null default '@citchennai.net',
  demo_mode boolean not null default false
);

insert into public.system_settings (id) values (true) on conflict (id) do nothing;

create table public.bus_identification_map (
  id boolean primary key default true check (id),
  image_url text not null,
  title text not null,
  effective_date text not null,
  updated_at timestamptz not null default now(),
  updated_by_name text not null,
  updated_by_email text not null,
  notes text,
  version integer not null default 1
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and p.role in ('driver', 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.routes enable row level security;
alter table public.buses enable row level security;
alter table public.trips enable row level security;
alter table public.student_qr_identities enable row level security;
alter table public.bookings enable row level security;
alter table public.boarding_events enable row level security;
alter table public.email_logs enable row level security;
alter table public.system_settings enable row level security;
alter table public.bus_identification_map enable row level security;

create policy "Profiles are visible to their owner and staff"
  on public.profiles for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select public.is_staff()));

create policy "Routes are visible to everyone"
  on public.routes for select to anon, authenticated using (true);

create policy "Buses are visible to everyone"
  on public.buses for select to anon, authenticated using (true);

create policy "Trips are visible to everyone"
  on public.trips for select to anon, authenticated using (true);

create policy "QR identities are visible to owner and staff"
  on public.student_qr_identities for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = student_qr_identities.user_id
        and p.auth_user_id = (select auth.uid())
    )
    or (select public.is_staff())
  );

create policy "Bookings are visible to owner and staff"
  on public.bookings for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = bookings.student_id
        and p.auth_user_id = (select auth.uid())
    )
    or (select public.is_staff())
  );

create policy "Boarding events are visible to owner and staff"
  on public.boarding_events for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = boarding_events.student_id
        and p.auth_user_id = (select auth.uid())
    )
    or (select public.is_staff())
  );

create policy "Email logs are visible to administrators"
  on public.email_logs for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.auth_user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy "Settings are readable by authenticated users"
  on public.system_settings for select to authenticated using (true);

create policy "Bus map is readable by everyone"
  on public.bus_identification_map for select to anon, authenticated using (true);

create or replace function public.verify_boarding(
  p_driver_id text,
  p_trip_id text,
  p_qr_identifier text,
  p_booking_reference text default null,
  p_method text default 'QR'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.profiles%rowtype;
  v_trip public.trips%rowtype;
  v_bus public.buses%rowtype;
  v_route public.routes%rowtype;
  v_qr public.student_qr_identities%rowtype;
  v_booking public.bookings%rowtype;
  v_student public.profiles%rowtype;
  v_boarded_at timestamptz;
  v_method text;
begin
  select * into v_driver from public.profiles where id = p_driver_id;
  if not found or v_driver.role not in ('driver', 'admin') then
    return jsonb_build_object('success', false, 'code', 'DRIVER_UNAUTHORIZED',
      'message', 'Device is not assigned to an authorized staff account.');
  end if;

  select * into v_trip from public.trips where id = p_trip_id;
  if not found then
    return jsonb_build_object('success', false, 'code', 'SERVER_ERROR',
      'message', 'Specified trip was not found in database.');
  end if;
  if v_driver.role = 'driver' and v_trip.assigned_driver_id is distinct from v_driver.id then
    return jsonb_build_object('success', false, 'code', 'DRIVER_UNAUTHORIZED',
      'message', 'You are not the assigned driver for this trip.');
  end if;

  select * into v_bus from public.buses where id = v_trip.bus_id;
  select * into v_route from public.routes where id = v_trip.route_id;

  if coalesce(p_qr_identifier, '') <> '' then
    select * into v_qr
      from public.student_qr_identities
      where opaque_qr_identifier = btrim(p_qr_identifier);
    if not found or v_qr.status <> 'ACTIVE' then
      return jsonb_build_object('success', false, 'code', 'QR_REVOKED_OR_INVALID',
        'message', 'QR code is invalid or has been revoked.');
    end if;

    select * into v_booking
      from public.bookings
      where student_id = v_qr.user_id and trip_id = v_trip.id
      order by created_at desc
      limit 1
      for update;

    if not found then
      if exists (
        select 1 from public.bookings
        where student_id = v_qr.user_id and booking_status = 'CONFIRMED'
          and trip_id <> v_trip.id
      ) then
        return jsonb_build_object('success', false, 'code', 'WRONG_TRIP',
          'message', 'Student holds a reservation for another trip.');
      end if;
      return jsonb_build_object('success', false, 'code', 'NO_BOOKING',
        'message', 'No active reservation found for this student on this trip.');
    end if;
  elsif coalesce(p_booking_reference, '') <> '' then
    select * into v_booking
      from public.bookings
      where upper(booking_reference) = upper(btrim(p_booking_reference))
      limit 1
      for update;
    if not found then
      return jsonb_build_object('success', false, 'code', 'NO_BOOKING',
        'message', 'No booking found with that reference.');
    end if;
    if v_booking.trip_id <> v_trip.id then
      return jsonb_build_object('success', false, 'code', 'WRONG_TRIP',
        'message', 'Booking belongs to a different trip.');
    end if;
  else
    return jsonb_build_object('success', false, 'code', 'SERVER_ERROR',
      'message', 'Either a QR identifier or booking reference is required.');
  end if;

  select * into v_student from public.profiles where id = v_booking.student_id;
  if v_booking.booking_status = 'CANCELLED' then
    return jsonb_build_object('success', false, 'code', 'BOOKING_CANCELLED',
      'message', 'This booking was cancelled.');
  end if;
  if v_booking.boarding_status = 'BOARDED' then
    select boarded_at into v_boarded_at
      from public.boarding_events where booking_id = v_booking.id;
    return jsonb_build_object('success', false, 'code', 'ALREADY_BOARDED',
      'message', 'Passenger has already boarded.',
      'passenger', jsonb_build_object(
        'student_name', v_student.name, 'student_email', v_student.email,
        'student_id_number', v_student.student_id_number,
        'booking_reference', v_booking.booking_reference, 'seat_id', v_booking.seat_id,
        'bus_number', v_bus.bus_number, 'route_name', v_route.name,
        'departure_time', v_trip.departure_time, 'boarded_at', v_boarded_at
      ));
  end if;

  v_boarded_at := now();
  v_method := case when p_method = 'MANUAL' and p_booking_reference is not null then 'MANUAL' else 'QR' end;

  update public.bookings
    set boarding_status = 'BOARDED'
    where id = v_booking.id;

  insert into public.boarding_events (
    id, booking_id, student_id, trip_id, scanned_by_driver_id, boarded_at, method
  ) values (
    'bde_' || gen_random_uuid()::text, v_booking.id, v_booking.student_id,
    v_trip.id, v_driver.id, v_boarded_at, v_method
  );

  return jsonb_build_object('success', true, 'code', 'VERIFIED',
    'message', 'Boarding verified successfully. Passenger permitted to board.',
    'passenger', jsonb_build_object(
      'student_name', v_student.name, 'student_email', v_student.email,
      'student_id_number', v_student.student_id_number,
      'booking_reference', v_booking.booking_reference, 'seat_id', v_booking.seat_id,
      'bus_number', v_bus.bus_number, 'route_name', v_route.name,
      'departure_time', v_trip.departure_time, 'boarded_at', v_boarded_at
    ));
end;
$$;

revoke all on function public.verify_boarding(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.verify_boarding(text, text, text, text, text) to service_role;
