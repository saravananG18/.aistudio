-- Supabase backend for the static GitHub Pages application.
-- Apply after 20261109160000_initial_schema.sql.

create or replace function public.current_profile_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.auth_user_id = (select auth.uid()) limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function public.can_view_trip(p_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.assigned_driver_id = public.current_profile_id()
  );
$$;

create or replace function public.provision_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id text := 'usr_' || replace(new.id::text, '-', '');
  v_name text := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1));
begin
  if exists (
    select 1 from public.system_settings s
    where s.id and s.restrict_email_domain
      and lower(new.email) not like '%' || lower(s.allowed_domain)
  ) then
    raise exception 'Registration is restricted to the approved email domain.';
  end if;

  insert into public.profiles (id, auth_user_id, name, email, role, is_verified, student_id_number, phone)
  values (
    v_profile_id,
    new.id,
    v_name,
    lower(new.email),
    'student',
    new.email_confirmed_at is not null,
    nullif(new.raw_user_meta_data ->> 'student_id_number', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        email = excluded.email,
        is_verified = public.profiles.is_verified or excluded.is_verified;

  select id into v_profile_id from public.profiles where auth_user_id = new.id;

  if exists (select 1 from public.profiles where id = v_profile_id and role = 'student') and not exists (
    select 1 from public.student_qr_identities q
    where q.user_id = v_profile_id and q.status = 'ACTIVE'
  ) then
    insert into public.student_qr_identities (id, user_id, opaque_qr_identifier, status)
    values (
      'qr_' || replace(new.id::text, '-', ''),
      v_profile_id,
      'CIT-QR-' || upper(replace(gen_random_uuid()::text, '-', '')),
      'ACTIVE'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_provision_profile on auth.users;
create trigger on_auth_user_provision_profile
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.provision_auth_profile();

-- Existing policies already provide public trip/route/bus reads and owner/staff
-- reads for sensitive records. These policies add authenticated admin writes.
drop policy if exists "Profiles are visible to their owner and staff" on public.profiles;
create policy "Profiles are visible to their owner and admins" on public.profiles
  for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "QR identities are visible to owner and staff" on public.student_qr_identities;
create policy "QR identities are visible to owner and admins" on public.student_qr_identities
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = student_qr_identities.user_id and p.auth_user_id = (select auth.uid()))
    or (select public.is_admin())
  );

drop policy if exists "Bookings are visible to owner and staff" on public.bookings;
create policy "Bookings are visible to owner, assigned driver, and admins" on public.bookings
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = bookings.student_id and p.auth_user_id = (select auth.uid()))
    or (select public.can_view_trip(bookings.trip_id))
  );

drop policy if exists "Boarding events are visible to owner and staff" on public.boarding_events;
create policy "Boarding events are visible to owner, assigned driver, and admins" on public.boarding_events
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = boarding_events.student_id and p.auth_user_id = (select auth.uid()))
    or (select public.can_view_trip(boarding_events.trip_id))
  );

drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Admins manage profiles" on public.profiles
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins manage routes" on public.routes;
create policy "Admins manage routes" on public.routes
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins manage buses" on public.buses;
create policy "Admins manage buses" on public.buses
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins manage trips" on public.trips;
create policy "Admins manage trips" on public.trips
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Assigned drivers update trip status" on public.trips;
create policy "Assigned drivers update trip status" on public.trips
  for update to authenticated
  using (assigned_driver_id = (select public.current_profile_id()))
  with check (assigned_driver_id = (select public.current_profile_id()));

drop policy if exists "Admins manage settings" on public.system_settings;
create policy "Admins manage settings" on public.system_settings
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins manage bus map" on public.bus_identification_map;
create policy "Admins manage bus map" on public.bus_identification_map
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins manage QR identities" on public.student_qr_identities;
create policy "Admins manage QR identities" on public.student_qr_identities
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins manage email logs" on public.email_logs;
create policy "Admins manage email logs" on public.email_logs
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select on public.routes, public.buses, public.trips, public.bus_identification_map to anon, authenticated;
grant select on public.profiles, public.student_qr_identities, public.bookings,
  public.boarding_events, public.email_logs, public.system_settings to authenticated;
grant insert, update, delete on public.routes, public.buses, public.trips,
  public.system_settings, public.bus_identification_map, public.student_qr_identities,
  public.email_logs, public.profiles to authenticated;
grant update (name, phone, student_id_number) on public.profiles to authenticated;

create or replace function public.create_booking(p_trip_id text, p_seat_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_trip public.trips%rowtype;
  v_bus public.buses%rowtype;
  v_booking public.bookings%rowtype;
  v_seat_number integer;
  v_seat_letter text;
begin
  select * into v_profile from public.profiles where auth_user_id = (select auth.uid());
  if not found or v_profile.role <> 'student' or not v_profile.is_verified then
    raise exception 'A verified student account is required to book.' using errcode = '42501';
  end if;
  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then raise exception 'Trip not found.'; end if;
  select * into v_bus from public.buses where id = v_trip.bus_id;
  if v_trip.status <> 'OPEN' then raise exception 'This trip is not open for booking.'; end if;
  if v_trip.travel_date < current_date then raise exception 'This trip has already passed.'; end if;
  if v_trip.booking_window_opens_at is not null and now() < v_trip.booking_window_opens_at then
    raise exception 'The booking window is not open yet.';
  end if;
  if v_trip.booking_window_closes_at is not null and now() > v_trip.booking_window_closes_at then
    raise exception 'The booking window has closed.';
  end if;
  v_seat_number := substring(upper(p_seat_id) from '^([0-9]+)')::integer;
  v_seat_letter := substring(upper(p_seat_id) from '([A-D])$');
  if v_seat_number is null or v_seat_letter is null or
     ((v_seat_number - 1) * 4 + ascii(v_seat_letter) - ascii('A') + 1) > v_bus.capacity then
    raise exception 'Invalid seat for this bus.';
  end if;
  if exists (select 1 from public.bookings where student_id = v_profile.id
    and trip_id = p_trip_id and booking_status = 'CONFIRMED') then
    raise exception 'You already have an active booking on this trip.';
  end if;
  if (select count(*) from public.bookings where trip_id = p_trip_id and booking_status = 'CONFIRMED') >= v_bus.capacity then
    raise exception 'This trip is full.';
  end if;

  insert into public.bookings (id, booking_reference, student_id, trip_id, seat_id, booking_status)
  values (
    'bk_' || replace(gen_random_uuid()::text, '-', ''),
    'CIT-BK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_profile.id, p_trip_id, upper(p_seat_id), 'CONFIRMED'
  ) returning * into v_booking;

  return jsonb_build_object('success', true, 'booking', to_jsonb(v_booking));
exception when unique_violation then
  raise exception 'That seat was just booked. Please choose another seat.' using errcode = '23505';
end;
$$;

create or replace function public.cancel_booking(p_booking_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id text := public.current_profile_id();
  v_booking public.bookings%rowtype;
begin
  update public.bookings set booking_status = 'CANCELLED', cancelled_at = now()
  where id = p_booking_id and student_id = v_profile_id
    and booking_status = 'CONFIRMED' and boarding_status = 'NOT BOARDED'
    and exists (select 1 from public.trips t where t.id = bookings.trip_id and t.travel_date >= current_date and t.status not in ('DEPARTED', 'COMPLETED'))
  returning * into v_booking;
  if not found then raise exception 'Booking not found or cannot be cancelled.'; end if;
  return jsonb_build_object('success', true, 'booking', to_jsonb(v_booking));
end;
$$;

create or replace function public.verify_boarding_for_driver(
  p_trip_id text, p_qr_identifier text default null,
  p_booking_reference text default null, p_method text default 'QR'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver_id text := public.current_profile_id();
begin
  if not exists (select 1 from public.profiles where id = v_driver_id and role in ('driver', 'admin')) then
    raise exception 'Only authenticated drivers or administrators can verify boarding.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.trips where id = p_trip_id and
    (assigned_driver_id = v_driver_id or exists (
      select 1 from public.profiles where id = v_driver_id and role = 'admin'
    ))) then
    raise exception 'You are not assigned to this trip.' using errcode = '42501';
  end if;
  return public.verify_boarding(v_driver_id, p_trip_id, p_qr_identifier, p_booking_reference, p_method);
end;
$$;

create or replace function public.admin_set_booking_window(p_trip_id text, p_action text)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare v_trip public.trips%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  update public.trips set status = case when upper(p_action) = 'OPEN' then 'OPEN' else 'CLOSED' end
  where id = p_trip_id returning * into v_trip;
  if not found then raise exception 'Trip not found.'; end if;
  return v_trip;
end;
$$;

create or replace function public.admin_set_all_booking_windows(p_open boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  update public.trips set status = case when p_open then 'OPEN' else 'CLOSED' end
    where status in ('OPEN', 'CLOSED', 'FULL');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_assign_driver(p_trip_id text, p_driver_id text)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare v_trip public.trips%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_driver_id and role = 'driver') then
    raise exception 'Select a valid driver account.';
  end if;
  update public.trips set assigned_driver_id = p_driver_id where id = p_trip_id returning * into v_trip;
  if not found then raise exception 'Trip not found.'; end if;
  return v_trip;
end;
$$;

create or replace function public.update_trip_status(p_trip_id text, p_status text, p_parking_bay text default null)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare v_trip public.trips%rowtype; v_profile_id text := public.current_profile_id();
begin
  if p_status not in ('OPEN', 'CLOSED', 'DEPARTED', 'COMPLETED', 'NOT YET OPEN') then
    raise exception 'Invalid trip status.';
  end if;
  if not public.is_admin() and p_status not in ('DEPARTED', 'COMPLETED') then
    raise exception 'Drivers may mark an assigned trip departed or completed only.' using errcode = '42501';
  end if;
  update public.trips set status = p_status, parking_bay = coalesce(p_parking_bay, parking_bay)
    where id = p_trip_id and (assigned_driver_id = v_profile_id or public.is_admin())
    returning * into v_trip;
  if not found then raise exception 'Trip not found or you are not assigned.' using errcode = '42501'; end if;
  return v_trip;
end;
$$;

create or replace function public.admin_clear_bookings()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  delete from public.boarding_events;
  delete from public.bookings;
  get diagnostics v_count = row_count;
  return jsonb_build_object('success', true, 'count', v_count, 'message', 'Bookings cleared.');
end;
$$;

create or replace function public.record_driver_email_log(
  p_booking_id text, p_status text, p_error_message text default null
)
returns public.email_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id text := public.current_profile_id();
  v_booking public.bookings%rowtype;
  v_student public.profiles%rowtype;
  v_trip public.trips%rowtype;
  v_log public.email_logs%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found.'; end if;
  select * into v_trip from public.trips where id = v_booking.trip_id;
  if not public.is_admin() and v_trip.assigned_driver_id is distinct from v_profile_id then
    raise exception 'You are not assigned to this trip.' using errcode = '42501';
  end if;
  select * into v_student from public.profiles where id = v_booking.student_id;
  insert into public.email_logs (id, booking_id, recipient_email, recipient_name, subject, body_preview, status, error_message)
  values ('eml_' || replace(gen_random_uuid()::text, '-', ''), v_booking.id, v_student.email, v_student.name,
    'CIT Booker boarding reminder', 'Boarding reminder for booking ' || v_booking.booking_reference,
    case when p_status = 'SENT' then 'SENT' else 'FAILED' end, p_error_message)
  returning * into v_log;
  return v_log;
end;
$$;

create or replace function public.admin_create_trip(
  p_bus_id text, p_route_id text, p_departure_time text, p_travel_date date default current_date,
  p_parking_bay text default '', p_assigned_driver_id text default null, p_notes text default ''
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare v_trip public.trips%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  insert into public.trips (id, bus_id, route_id, assigned_driver_id, travel_date, departure_time,
    departure_time_iso, booking_window_opens_at, booking_window_closes_at, status, parking_bay, notes)
  values ('trip_' || replace(gen_random_uuid()::text, '-', ''), p_bus_id, p_route_id,
    p_assigned_driver_id, p_travel_date, p_departure_time, null, now(),
    (p_travel_date::timestamp + interval '23 hours 59 minutes') at time zone 'Asia/Kolkata',
    'OPEN', coalesce(p_parking_bay, ''), coalesce(p_notes, ''))
  returning * into v_trip;
  return v_trip;
end;
$$;

create or replace function public.admin_revoke_student_qr(p_student_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  update public.student_qr_identities set status = 'REVOKED', revoked_at = now()
    where user_id = p_student_id and status = 'ACTIVE';
end;
$$;

create or replace function public.admin_regenerate_student_qr(p_student_id text)
returns public.student_qr_identities
language plpgsql
security definer
set search_path = ''
as $$
declare v_qr public.student_qr_identities%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  update public.student_qr_identities set status = 'REVOKED', revoked_at = now()
    where user_id = p_student_id and status = 'ACTIVE';
  insert into public.student_qr_identities (id, user_id, opaque_qr_identifier, status, regenerated_at)
    values ('qr_' || replace(gen_random_uuid()::text, '-', ''), p_student_id,
      'CIT-QR-' || upper(replace(gen_random_uuid()::text, '-', '')), 'ACTIVE', now())
    returning * into v_qr;
  return v_qr;
end;
$$;

create or replace function public.public_trip_metrics(p_trip_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'booked', count(*) filter (where b.booking_status = 'CONFIRMED'),
    'boarded', count(*) filter (where b.booking_status = 'CONFIRMED' and b.boarding_status = 'BOARDED'),
    'occupied_seats', coalesce(jsonb_agg(b.seat_id) filter (where b.booking_status = 'CONFIRMED'), '[]'::jsonb)
  )
  from public.bookings b where b.trip_id = p_trip_id;
$$;

create or replace function public.public_driver_card(p_driver_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role)
  from public.profiles p where p.id = p_driver_id and p.role = 'driver';
$$;

create or replace function public.get_trip_manifest(p_trip_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id text := public.current_profile_id();
  v_trip public.trips%rowtype;
  v_manifest jsonb;
  v_total integer;
  v_boarded integer;
begin
  select * into v_trip from public.trips where id = p_trip_id;
  if not found then raise exception 'Trip not found.'; end if;
  if not public.is_admin() and v_trip.assigned_driver_id is distinct from v_profile_id then
    raise exception 'You are not assigned to this trip.' using errcode = '42501';
  end if;
  select count(*)::integer, count(*) filter (where b.boarding_status = 'BOARDED')::integer,
    coalesce(jsonb_agg(jsonb_build_object(
      'booking_id', b.id, 'booking_reference', b.booking_reference, 'seat_id', b.seat_id,
      'student_name', p.name, 'student_email', p.email, 'student_id_number', p.student_id_number,
      'boarding_status', b.boarding_status, 'boarded_at', e.boarded_at, 'method', e.method
    ) order by b.seat_id), '[]'::jsonb)
    into v_total, v_boarded, v_manifest
    from public.bookings b
    join public.profiles p on p.id = b.student_id
    left join public.boarding_events e on e.booking_id = b.id
    where b.trip_id = p_trip_id and b.booking_status = 'CONFIRMED';
  return jsonb_build_object('trip', to_jsonb(v_trip), 'total_passengers', v_total,
    'boarded_passengers', v_boarded, 'remaining_passengers', v_total - v_boarded, 'manifest', v_manifest);
end;
$$;

create or replace function public.admin_create_route(p_name text, p_route_number integer, p_stops jsonb)
returns public.routes
language plpgsql
security definer
set search_path = ''
as $$
declare v_route public.routes%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  insert into public.routes (id, route_number, name, ordered_stops)
    values ('route_' || replace(gen_random_uuid()::text, '-', ''), p_route_number, p_name, coalesce(p_stops, '[]'::jsonb))
    returning * into v_route;
  return v_route;
end;
$$;

create or replace function public.admin_create_bus(
  p_bus_number text, p_bus_name text, p_capacity integer, p_route_id text,
  p_departure_time text, p_parking_bay text default '', p_assigned_driver_id text default null,
  p_new_route_name text default null, p_new_route_stops jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route public.routes%rowtype;
  v_bus public.buses%rowtype;
  v_trip public.trips%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if p_new_route_name is not null then
    insert into public.routes (id, route_number, name, ordered_stops)
    values ('route_' || replace(gen_random_uuid()::text, '-', ''), substring(p_bus_number from '([0-9]+)$')::integer, p_new_route_name, coalesce(p_new_route_stops, '[]'::jsonb))
    returning * into v_route;
  else
    select * into v_route from public.routes where id = p_route_id;
    if not found then raise exception 'Select a valid route.'; end if;
  end if;
  insert into public.buses (id, bus_number, bus_name, capacity, layout, is_active, route_id, route_number)
  values ('bus_' || replace(gen_random_uuid()::text, '-', ''), p_bus_number, p_bus_name,
    greatest(1, p_capacity), '2x2', true, v_route.id, v_route.route_number)
  returning * into v_bus;
  insert into public.trips (id, bus_id, route_id, assigned_driver_id, travel_date, departure_time,
    booking_window_opens_at, booking_window_closes_at, status, parking_bay)
  values ('trip_' || replace(gen_random_uuid()::text, '-', ''), v_bus.id, v_route.id,
    p_assigned_driver_id, current_date, p_departure_time, now(),
    (current_date::timestamp + interval '23 hours 59 minutes') at time zone 'Asia/Kolkata',
    'OPEN', coalesce(p_parking_bay, '')) returning * into v_trip;
  return jsonb_build_object('success', true, 'bus', to_jsonb(v_bus), 'route', to_jsonb(v_route), 'trip', to_jsonb(v_trip));
end;
$$;

revoke all on function public.create_booking(text, text) from public, anon;
revoke all on function public.cancel_booking(text) from public, anon;
revoke all on function public.verify_boarding_for_driver(text, text, text, text) from public, anon;
revoke all on function public.admin_set_booking_window(text, text) from public, anon;
revoke all on function public.admin_set_all_booking_windows(boolean) from public, anon;
revoke all on function public.admin_assign_driver(text, text) from public, anon;
revoke all on function public.admin_create_trip(text, text, text, date, text, text, text) from public, anon;
revoke all on function public.admin_revoke_student_qr(text) from public, anon;
revoke all on function public.admin_regenerate_student_qr(text) from public, anon;
revoke all on function public.update_trip_status(text, text, text) from public, anon;
revoke all on function public.admin_clear_bookings() from public, anon;
revoke all on function public.record_driver_email_log(text, text, text) from public, anon;
revoke all on function public.get_trip_manifest(text) from public, anon;
revoke all on function public.admin_create_route(text, integer, jsonb) from public, anon;
revoke all on function public.admin_create_bus(text, text, integer, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_booking(text, text) to authenticated;
grant execute on function public.cancel_booking(text) to authenticated;
grant execute on function public.verify_boarding_for_driver(text, text, text, text) to authenticated;
grant execute on function public.admin_set_booking_window(text, text) to authenticated;
grant execute on function public.admin_set_all_booking_windows(boolean) to authenticated;
grant execute on function public.admin_assign_driver(text, text) to authenticated;
grant execute on function public.admin_create_trip(text, text, text, date, text, text, text) to authenticated;
grant execute on function public.admin_revoke_student_qr(text) to authenticated;
grant execute on function public.admin_regenerate_student_qr(text) to authenticated;
grant execute on function public.update_trip_status(text, text, text) to authenticated;
grant execute on function public.admin_clear_bookings() to authenticated;
grant execute on function public.record_driver_email_log(text, text, text) to authenticated;
grant execute on function public.public_trip_metrics(text) to anon, authenticated;
grant execute on function public.public_driver_card(text) to anon, authenticated;
grant execute on function public.get_trip_manifest(text) to authenticated;
grant execute on function public.admin_create_route(text, integer, jsonb) to authenticated;
grant execute on function public.admin_create_bus(text, text, integer, text, text, text, text, text, jsonb) to authenticated;
