declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const jsonHeaders = { 'Content-Type': 'application/json' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function constantTimeEquals(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  const expectedToken = Deno.env.get('ESP32_DEVICE_TOKEN');
  const driverId = Deno.env.get('ESP32_DRIVER_ID');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!expectedToken || !driverId || !supabaseUrl || !serviceRoleKey) {
    console.error('Missing ESP32 verification function configuration.');
    return jsonResponse(500, { error: 'Boarding verification is not configured.' });
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const receivedToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (!constantTimeEquals(receivedToken, expectedToken)) {
    return jsonResponse(401, {
      success: false,
      code: 'DRIVER_UNAUTHORIZED',
      message: 'Invalid device credentials.'
    });
  }

  let payload: { trip_id?: unknown; qr_identifier?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Request body must be valid JSON.' });
  }

  if (
    typeof payload.trip_id !== 'string' ||
    payload.trip_id.length === 0 ||
    payload.trip_id.length > 128 ||
    typeof payload.qr_identifier !== 'string' ||
    payload.qr_identifier.length === 0 ||
    payload.qr_identifier.length > 256
  ) {
    return jsonResponse(400, {
      success: false,
      code: 'SERVER_ERROR',
      message: 'A trip ID and decoded QR identifier are required.'
    });
  }

  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/verify_boarding`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_driver_id: driverId,
      p_trip_id: payload.trip_id,
      p_qr_identifier: payload.qr_identifier,
      p_booking_reference: null,
      p_method: 'QR'
    })
  });

  if (!response.ok) {
    console.error('Boarding database function failed:', response.status, await response.text());
    return jsonResponse(500, {
      success: false,
      code: 'SERVER_ERROR',
      message: 'Boarding verification could not be completed.'
    });
  }

  const result = await response.json();
  return jsonResponse(result.success ? 200 : 400, result);
});
