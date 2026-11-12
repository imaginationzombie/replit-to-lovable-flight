export async function quotePaypal(path: string, method = 'GET', body?: unknown, requestId?: string) {
 const key = process.env['LOVABLE_API_KEY']; const connection = process.env['PAYPAL_API_KEY'];
 if (!key || !connection) throw new Error('PayPal is not connected. Please contact us.');
 const response = await fetch(`https://connector-gateway.lovable.dev/paypal${path}`, {
  method, headers: { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': connection, 'Content-Type': 'application/json', ...(requestId ? {'PayPal-Request-Id':requestId} : {}) },
  ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(25000),
 });
 if (!response.ok) { const error = await response.text(); console.error(`PayPal quote request failed [${response.status}]: ${error}`); throw new Error(`PayPal could not complete checkout (${response.status}). Check PayPal before trying again.`); }
 return response;
}