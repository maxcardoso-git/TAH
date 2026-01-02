import { ArrowRight, CheckCircle2, Code2, Key, Link, Server, Shield, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/KVR-Logo.png" alt="TAH" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">TAH - Tenant Access Hub</h1>
              <p className="text-sm text-slate-500">Integration Documentation</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-6xl">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <Badge variant="outline" className="mb-4">v2.0 Integration Spec</Badge>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">How TAH Authentication Works</h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            TAH provides centralized authentication and authorization for all applications in the ecosystem.
            Applications receive signed JWT tokens with user identity, roles, and permissions.
          </p>
        </section>

        {/* Flow Diagram */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">Authentication Flow</h3>
          <Card className="overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4 text-center">
                {/* Step 1 */}
                <div className="flex flex-col items-center p-4 min-w-[180px]">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-900">1. User Login</span>
                  <span className="text-sm text-slate-500 mt-1">User authenticates in TAH</span>
                </div>

                <ArrowRight className="w-6 h-6 text-slate-300 hidden lg:block" />
                <div className="h-6 w-px bg-slate-200 lg:hidden" />

                {/* Step 2 */}
                <div className="flex flex-col items-center p-4 min-w-[180px]">
                  <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                    <Link className="w-8 h-8 text-purple-600" />
                  </div>
                  <span className="font-semibold text-slate-900">2. App Launcher</span>
                  <span className="text-sm text-slate-500 mt-1">User clicks on an app</span>
                </div>

                <ArrowRight className="w-6 h-6 text-slate-300 hidden lg:block" />
                <div className="h-6 w-px bg-slate-200 lg:hidden" />

                {/* Step 3 */}
                <div className="flex flex-col items-center p-4 min-w-[180px]">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                    <Key className="w-8 h-8 text-amber-600" />
                  </div>
                  <span className="font-semibold text-slate-900">3. Token Generation</span>
                  <span className="text-sm text-slate-500 mt-1">TAH creates signed JWT</span>
                </div>

                <ArrowRight className="w-6 h-6 text-slate-300 hidden lg:block" />
                <div className="h-6 w-px bg-slate-200 lg:hidden" />

                {/* Step 4 */}
                <div className="flex flex-col items-center p-4 min-w-[180px]">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
                    <Server className="w-8 h-8 text-green-600" />
                  </div>
                  <span className="font-semibold text-slate-900">4. Callback</span>
                  <span className="text-sm text-slate-500 mt-1">App validates token</span>
                </div>

                <ArrowRight className="w-6 h-6 text-slate-300 hidden lg:block" />
                <div className="h-6 w-px bg-slate-200 lg:hidden" />

                {/* Step 5 */}
                <div className="flex flex-col items-center p-4 min-w-[180px]">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <span className="font-semibold text-slate-900">5. Session</span>
                  <span className="text-sm text-slate-500 mt-1">User is logged in</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Detailed Steps */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Detailed Flow</h3>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</span>
                  User Login in TAH
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  User enters credentials (email/password) in TAH login page. After successful authentication,
                  TAH creates a session and redirects to the App Launcher.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">2</span>
                  App Launcher - User Clicks App
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  The App Launcher shows all applications available for the user's tenant. When the user clicks an app,
                  TAH prepares to generate an authentication token for that specific application.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center text-sm font-bold">3</span>
                  Token Generation (RS256 JWT)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  TAH generates a JWT token signed with RS256 algorithm containing:
                </p>
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-100 overflow-x-auto">
                  <pre>{`{
  "sub": "user-uuid",           // User ID
  "email": "user@email.com",    // User email
  "name": "User Name",          // Display name
  "tenant_id": "tenant-uuid",   // Tenant ID
  "org_id": "mapped-org-id",    // Organization ID for data filtering
  "roles": ["admin", "user"],   // User roles in tenant
  "permissions": ["read", "write"], // Permissions for this app
  "aud": "app_id",              // Target application ID
  "iss": "http://tah-url",      // TAH issuer URL
  "exp": 1234567890,            // Expiration timestamp
  "iat": 1234567890             // Issued at timestamp
}`}</pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">4</span>
                  Redirect to Application Callback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  TAH redirects the browser to the application's callback URL with the token:
                </p>
                <div className="bg-slate-100 rounded-lg p-4 font-mono text-sm text-slate-800 break-all">
                  {`{launch_url}/auth/tah-callback?token={jwt_token}`}
                </div>
                <p className="text-slate-600 mt-4">
                  The application must validate the token using TAH's JWKS endpoint to get the public key.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">5</span>
                  Session Creation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  After validating the token, the application creates a local session (JIT provisioning),
                  sets a session cookie, and redirects the user to the application's main page.
                  The <code className="bg-slate-100 px-1.5 py-0.5 rounded">org_id</code> from the token
                  is used to filter all data for multi-tenancy.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Integration Requirements */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Integration Requirements</h3>

          <Tabs defaultValue="env" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="env">Environment</TabsTrigger>
              <TabsTrigger value="endpoint">Callback Endpoint</TabsTrigger>
              <TabsTrigger value="validation">Token Validation</TabsTrigger>
              <TabsTrigger value="tah-config">TAH Config</TabsTrigger>
            </TabsList>

            <TabsContent value="env" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Environment Variables</CardTitle>
                  <CardDescription>Required environment variables for your application</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold">Variable</th>
                          <th className="text-left py-3 px-4 font-semibold">Description</th>
                          <th className="text-left py-3 px-4 font-semibold">Example</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-3 px-4 font-mono text-blue-600">TAH_JWKS_URL</td>
                          <td className="py-3 px-4">JWKS endpoint for public keys</td>
                          <td className="py-3 px-4 font-mono text-xs">http://72.61.52.70:3050/.well-known/jwks.json</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-3 px-4 font-mono text-blue-600">TAH_ISSUER</td>
                          <td className="py-3 px-4">Expected token issuer</td>
                          <td className="py-3 px-4 font-mono text-xs">http://72.61.52.70:3050</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-3 px-4 font-mono text-blue-600">APP_ID</td>
                          <td className="py-3 px-4">Your application ID (audience)</td>
                          <td className="py-3 px-4 font-mono text-xs">my_application</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-3 px-4 font-mono text-blue-600">FRONTEND_URL</td>
                          <td className="py-3 px-4">Redirect after login</td>
                          <td className="py-3 px-4 font-mono text-xs">http://myapp.com</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono text-blue-600">COOKIE_DOMAIN</td>
                          <td className="py-3 px-4">Cookie domain (no port)</td>
                          <td className="py-3 px-4 font-mono text-xs">myapp.com</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="endpoint" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Callback Endpoint</CardTitle>
                  <CardDescription>Your application must implement this endpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Badge>GET</Badge>
                    <code className="ml-2 text-lg font-mono">/auth/tah-callback</code>
                  </div>

                  <h4 className="font-semibold mb-2">Query Parameters:</h4>
                  <div className="bg-slate-100 rounded-lg p-4 font-mono text-sm mb-4">
                    token: string (JWT)
                  </div>

                  <h4 className="font-semibold mb-2">Expected Behavior:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-slate-600">
                    <li>Receive the <code className="bg-slate-100 px-1 rounded">token</code> query parameter</li>
                    <li>Validate JWT using JWKS from <code className="bg-slate-100 px-1 rounded">TAH_JWKS_URL</code></li>
                    <li>Verify issuer matches <code className="bg-slate-100 px-1 rounded">TAH_ISSUER</code></li>
                    <li>Verify audience matches <code className="bg-slate-100 px-1 rounded">APP_ID</code></li>
                    <li>Extract <code className="bg-slate-100 px-1 rounded">org_id</code> for data filtering</li>
                    <li>Create/update user (JIT provisioning)</li>
                    <li>Create session and set cookie</li>
                    <li>Redirect to <code className="bg-slate-100 px-1 rounded">FRONTEND_URL</code></li>
                  </ol>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="validation" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Token Validation (Python Example)</CardTitle>
                  <CardDescription>Example implementation using PyJWT</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-100 overflow-x-auto">
                    <pre>{`from jwt import PyJWKClient
import jwt

class TAHTokenValidator:
    def __init__(self, jwks_url: str, issuer: str, audience: str):
        self.jwks_client = PyJWKClient(jwks_url, cache_keys=True)
        self.issuer = issuer
        self.audience = audience

    def validate(self, token: str) -> dict:
        # Get signing key from JWKS
        signing_key = self.jwks_client.get_signing_key_from_jwt(token)

        # Decode and validate token
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=self.audience,
            issuer=self.issuer,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]}
        )

        # Validate org_id is present
        if not payload.get("org_id"):
            raise ValueError("Missing org_id in token")

        return payload

# Usage
validator = TAHTokenValidator(
    jwks_url=os.getenv("TAH_JWKS_URL"),
    issuer=os.getenv("TAH_ISSUER"),
    audience=os.getenv("APP_ID")
)

payload = validator.validate(token)
org_id = payload["org_id"]  # Use for data filtering`}</pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tah-config" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>TAH Configuration</CardTitle>
                  <CardDescription>Required setup in TAH for your application</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-2">1. Register Application in App Catalog</h4>
                    <p className="text-slate-600">Add your application to the global app catalog with a unique ID.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">2. Configure Application for Tenant</h4>
                    <p className="text-slate-600 mb-2">Set these fields in the applications table:</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-4 font-semibold">Field</th>
                            <th className="text-left py-2 px-4 font-semibold">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-mono">id</td>
                            <td className="py-2 px-4">Unique application ID (e.g., my_app)</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-mono">base_url</td>
                            <td className="py-2 px-4">Frontend URL (e.g., http://myapp:3000)</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-mono">launch_url</td>
                            <td className="py-2 px-4">API URL for callback (e.g., http://myapp:8000)</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 font-mono">callback_url</td>
                            <td className="py-2 px-4">/auth/tah-callback</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">3. Create App Org Mapping</h4>
                    <p className="text-slate-600">Map the TAH tenant to your application's org_id:</p>
                    <div className="bg-slate-100 rounded-lg p-4 font-mono text-sm mt-2">
                      tenant_id → remote_org_id
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        {/* Key Concepts */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Key Concepts</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Centralized Organizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Organizations are managed <strong>only in TAH</strong>. Applications do NOT need their own
                  organizations table. Use <code className="bg-slate-100 px-1 rounded">org_id</code> as a
                  simple VARCHAR filter for multi-tenancy.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  JIT Provisioning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Users are created automatically on first login (Just-In-Time provisioning).
                  Store minimal user data: <code className="bg-slate-100 px-1 rounded">tah_user_id</code>,
                  <code className="bg-slate-100 px-1 rounded">org_id</code>, email, and name.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-600" />
                  JWKS Validation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Tokens are signed with RS256 (asymmetric). Validate using the public key from
                  <code className="bg-slate-100 px-1 rounded">/.well-known/jwks.json</code>.
                  Cache the key for performance.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-green-600" />
                  Permission Checking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Permissions are included in the JWT. Check them for authorization:
                  <code className="bg-slate-100 px-1 rounded">permissions: ["read", "write"]</code>.
                  Use these to protect endpoints and UI elements.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* JWKS Endpoint */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">TAH Endpoints</h3>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                  <Badge variant="outline">GET</Badge>
                  <div>
                    <code className="font-mono text-blue-600">/.well-known/jwks.json</code>
                    <p className="text-sm text-slate-600 mt-1">Public keys for JWT validation (JWKS format)</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                  <Badge variant="outline">POST</Badge>
                  <div>
                    <code className="font-mono text-blue-600">/api/v1/auth/app-token</code>
                    <p className="text-sm text-slate-600 mt-1">Generate token for application (internal use)</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                  <Badge variant="outline">GET</Badge>
                  <div>
                    <code className="font-mono text-blue-600">/api/v1/auth/app-launcher</code>
                    <p className="text-sm text-slate-600 mt-1">Get available applications for user</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Verification Checklist */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">Verification Checklist</h3>
          <Card>
            <CardHeader>
              <CardTitle>Run these commands to verify your integration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-100 overflow-x-auto">
                <pre>{`# 1. Check environment variables
docker exec YOUR_CONTAINER env | grep -E "TAH_|APP_ID|FRONTEND|COOKIE"

# 2. Test JWKS endpoint access
docker exec YOUR_CONTAINER python3 -c "
import urllib.request, json
url = 'http://72.61.52.70:3050/.well-known/jwks.json'
resp = urllib.request.urlopen(url, timeout=5)
data = json.loads(resp.read())
print('JWKS OK - Keys:', len(data.get('keys', [])))
"

# 3. Verify callback endpoint exists (should return 401 for invalid token)
curl -s -o /dev/null -w "%{http_code}" "http://YOUR_APP/auth/tah-callback?token=test"

# 4. Check application logs for errors
docker logs YOUR_CONTAINER --tail 20 2>&1 | grep -i "error\\|fail"`}</pre>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-sm py-8 border-t">
          <p>TAH - Tenant Access Hub v2.0</p>
          <p className="mt-1">Centralized Authentication for Multi-Tenant Applications</p>
        </footer>
      </main>
    </div>
  )
}
