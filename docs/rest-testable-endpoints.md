# REST Testable Endpoints

UNICON now provides **pre-filled, ready-to-test endpoints** for REST API presets. Users can immediately send requests without manually filling out forms.

## How It Works

1. **Select a Quick Pick preset** (e.g., JSONPlaceholder, HTTPBin, ReqRes)
2. A list of **testable endpoints** appears below the dropdown
3. **Click any endpoint** to auto-fill:
   - HTTP method (GET, POST, PUT, PATCH, DELETE)
   - Endpoint path
   - Request headers (e.g., `Content-Type: application/json`)
   - Request body (for POST/PUT/PATCH)
4. **Click Send** — the request is ready to go

## Available Presets

| Preset | Base URL | Endpoints | Description |
|--------|----------|-----------|-------------|
| JSONPlaceholder | `https://jsonplaceholder.typicode.com` | 9 | Fake REST API for testing |
| HTTPBin | `https://httpbin.org` | 12 | HTTP request/response service |
| Cat Facts | `https://catfact.ninja` | 4 | Random cat facts |
| Dog CEO | `https://dog.ceo` | 5 | Random dog images |
| Bored API | `https://www.boredapi.com` | 5 | Activities to beat boredom |
| Advice Slip | `https://api.adviceslip.com` | 3 | Random life advice |
| IPify | `https://api.ipify.org` | 2 | Public IP lookup |
| Agify | `https://api.agify.io` | 3 | Age prediction by name |
| ReqRes | `https://reqres.in` | 9 | Hosted API with auth support |

## Example: Testing JSONPlaceholder

### GET Request
```
Method: GET
Path:   /posts/1
```
Click the endpoint, then click **Send**.

### POST Request with Body
```
Method: POST
Path:   /posts
Headers:
  Content-Type: application/json
Body:
  {
    "title": "New Post",
    "body": "This is the post content.",
    "userId": 1
  }
```
The body and headers are pre-filled automatically.

## Adding Custom Presets

Edit `client/src/features/examples/presets.js`:

```javascript
{
  name: 'My API',
  baseUrl: 'https://api.example.com',
  tryPath: '/health',
  description: 'My custom API',
  endpoints: [
    { method: 'GET', path: '/users', summary: 'List users' },
    {
      method: 'POST',
      path: '/users',
      summary: 'Create user',
      headers: { 'Content-Type': 'application/json' },
      body: { name: 'John', email: 'john@example.com' }
    }
  ]
}
```

### Endpoint Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | string | Yes | HTTP method (GET, POST, PUT, PATCH, DELETE) |
| `path` | string | Yes | Endpoint path (e.g., `/users/1`) |
| `summary` | string | No | Short description shown in the UI |
| `headers` | object | No | Key-value pairs for request headers |
| `body` | object | No | JSON body for POST/PUT/PATCH requests |

## UI Features

- **Color-coded badges**: GET (green), POST (blue), PUT (yellow), PATCH (orange), DELETE (red)
- **Collapsible list**: Hide/show endpoints with one click
- **Body indicator**: Endpoints with pre-filled bodies show a `+ body` badge
- **Sticky header**: API name stays visible when scrolling through endpoints

## OpenAPI Integration

For APIs with an OpenAPI/Swagger spec, UNICON can also parse the spec and show all available endpoints. This works in addition to the preset endpoints:

1. Upload an OpenAPI YAML/JSON file, **or**
2. Enter the OpenAPI spec URL and click **Load**

The parsed endpoints will appear in the **OpenAPI / Swagger** section with the same click-to-fill behavior.
