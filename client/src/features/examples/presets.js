// client/src/features/examples/presets.js
// REST presets with ready-to-test endpoints - users can send requests immediately
export const EXAMPLE_PRESETS = {
  rest: [
    {
      name: 'JSONPlaceholder',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      tryPath: '/posts/1',
      description: 'Fake online REST API for testing and prototyping.',
      endpoints: [
        { method: 'GET', path: '/posts', summary: 'Get all posts' },
        { method: 'GET', path: '/posts/1', summary: 'Get post by ID' },
        { method: 'GET', path: '/posts/1/comments', summary: 'Get comments for post' },
        { method: 'GET', path: '/users', summary: 'Get all users' },
        { method: 'GET', path: '/users/1', summary: 'Get user by ID' },
        {
          method: 'POST',
          path: '/posts',
          summary: 'Create a new post',
          headers: { 'Content-Type': 'application/json' },
          body: { title: 'New Post', body: 'This is the post content.', userId: 1 }
        },
        {
          method: 'PUT',
          path: '/posts/1',
          summary: 'Update post',
          headers: { 'Content-Type': 'application/json' },
          body: { id: 1, title: 'Updated Title', body: 'Updated content.', userId: 1 }
        },
        {
          method: 'PATCH',
          path: '/posts/1',
          summary: 'Partial update post',
          headers: { 'Content-Type': 'application/json' },
          body: { title: 'Patched Title' }
        },
        { method: 'DELETE', path: '/posts/1', summary: 'Delete post' }
      ]
    },
    {
      name: 'HTTPBin',
      baseUrl: 'https://httpbin.org',
      tryPath: '/get',
      description: 'HTTP request & response service with many endpoints.',
      endpoints: [
        { method: 'GET', path: '/get', summary: 'Returns GET data' },
        { method: 'GET', path: '/ip', summary: 'Returns origin IP' },
        { method: 'GET', path: '/headers', summary: 'Returns request headers' },
        { method: 'GET', path: '/user-agent', summary: 'Returns user-agent' },
        { method: 'GET', path: '/uuid', summary: 'Returns UUID4' },
        { method: 'GET', path: '/delay/1', summary: 'Delays response by 1s' },
        { method: 'GET', path: '/status/200', summary: 'Returns status 200' },
        { method: 'GET', path: '/status/404', summary: 'Returns status 404' },
        {
          method: 'POST',
          path: '/post',
          summary: 'Returns POST data',
          headers: { 'Content-Type': 'application/json' },
          body: { message: 'Hello HTTPBin!', count: 42 }
        },
        {
          method: 'PUT',
          path: '/put',
          summary: 'Returns PUT data',
          headers: { 'Content-Type': 'application/json' },
          body: { updated: true, value: 'test' }
        },
        {
          method: 'DELETE',
          path: '/delete',
          summary: 'Returns DELETE data'
        },
        {
          method: 'POST',
          path: '/anything',
          summary: 'Returns anything passed',
          headers: { 'Content-Type': 'application/json', 'X-Custom-Header': 'test-value' },
          body: { test: 'data', nested: { key: 'value' } }
        }
      ]
    },
    {
      name: 'Cat Facts',
      baseUrl: 'https://catfact.ninja',
      tryPath: '/fact',
      description: 'Random cat facts.',
      endpoints: [
        { method: 'GET', path: '/fact', summary: 'Get a random cat fact' },
        { method: 'GET', path: '/facts', summary: 'Get multiple cat facts' },
        { method: 'GET', path: '/facts?limit=5', summary: 'Get 5 cat facts' },
        { method: 'GET', path: '/breeds', summary: 'Get cat breeds' }
      ]
    },
    {
      name: 'Dog CEO',
      baseUrl: 'https://dog.ceo',
      tryPath: '/api/breeds/image/random',
      description: 'Random dog images.',
      endpoints: [
        { method: 'GET', path: '/api/breeds/image/random', summary: 'Random dog image' },
        { method: 'GET', path: '/api/breeds/image/random/3', summary: '3 random dog images' },
        { method: 'GET', path: '/api/breeds/list/all', summary: 'List all breeds' },
        { method: 'GET', path: '/api/breed/husky/images', summary: 'Husky images' },
        { method: 'GET', path: '/api/breed/labrador/images/random', summary: 'Random labrador image' }
      ]
    },
    {
      name: 'Bored API',
      baseUrl: 'https://www.boredapi.com',
      tryPath: '/api/activity',
      description: 'Random activities to beat boredom.',
      endpoints: [
        { method: 'GET', path: '/api/activity', summary: 'Random activity' },
        { method: 'GET', path: '/api/activity?type=education', summary: 'Educational activity' },
        { method: 'GET', path: '/api/activity?type=recreational', summary: 'Recreational activity' },
        { method: 'GET', path: '/api/activity?participants=2', summary: 'Activity for 2 people' },
        { method: 'GET', path: '/api/activity?minprice=0&maxprice=0', summary: 'Free activity' }
      ]
    },
    {
      name: 'Advice Slip',
      baseUrl: 'https://api.adviceslip.com',
      tryPath: '/advice',
      description: 'Random life advice.',
      endpoints: [
        { method: 'GET', path: '/advice', summary: 'Random advice' },
        { method: 'GET', path: '/advice/1', summary: 'Advice by ID' },
        { method: 'GET', path: '/advice/search/life', summary: 'Search advice about life' }
      ]
    },
    {
      name: 'IPify',
      baseUrl: 'https://api.ipify.org',
      tryPath: '/?format=json',
      description: 'Returns your public IP in JSON.',
      endpoints: [
        { method: 'GET', path: '/?format=json', summary: 'Get IP as JSON' },
        { method: 'GET', path: '/?format=text', summary: 'Get IP as text' }
      ]
    },
    {
      name: 'Agify',
      baseUrl: 'https://api.agify.io',
      tryPath: '/?name=michael',
      description: 'Predict age by name.',
      endpoints: [
        { method: 'GET', path: '/?name=michael', summary: 'Predict age for Michael' },
        { method: 'GET', path: '/?name=anna', summary: 'Predict age for Anna' },
        { method: 'GET', path: '/?name=john&country_id=US', summary: 'Predict age for John (US)' }
      ]
    },
    {
      name: 'ReqRes',
      baseUrl: 'https://reqres.in',
      tryPath: '/api/users',
      description: 'Hosted REST API for testing with realistic responses.',
      endpoints: [
        { method: 'GET', path: '/api/users', summary: 'List users (page 1)' },
        { method: 'GET', path: '/api/users?page=2', summary: 'List users (page 2)' },
        { method: 'GET', path: '/api/users/2', summary: 'Get single user' },
        { method: 'GET', path: '/api/users/23', summary: 'User not found (404)' },
        {
          method: 'POST',
          path: '/api/users',
          summary: 'Create user',
          headers: { 'Content-Type': 'application/json' },
          body: { name: 'John Doe', job: 'Developer' }
        },
        {
          method: 'PUT',
          path: '/api/users/2',
          summary: 'Update user',
          headers: { 'Content-Type': 'application/json' },
          body: { name: 'Jane Doe', job: 'Manager' }
        },
        { method: 'DELETE', path: '/api/users/2', summary: 'Delete user' },
        {
          method: 'POST',
          path: '/api/register',
          summary: 'Register user',
          headers: { 'Content-Type': 'application/json' },
          body: { email: 'eve.holt@reqres.in', password: 'pistol' }
        },
        {
          method: 'POST',
          path: '/api/login',
          summary: 'Login user',
          headers: { 'Content-Type': 'application/json' },
          body: { email: 'eve.holt@reqres.in', password: 'cityslicka' }
        }
      ]
    }
  ],
  ws: [
    { name: 'Public Echo', url: 'wss://echo.websocket.events', description: 'Simple echo server for quick WebSocket tests.' }
  ],
  sql: [
    { name: 'SQLite (in-memory)', config: { driver: 'sqlite', filename: ':memory:' }, description: 'Temporary DB; perfect for a quick SELECT 1 test.' }
  ],
  opcua: [
    { name: 'Prosys Demo', endpointUrl: 'opc.tcp://uademo.prosysopc.com:53530/OPCUA/Simulation', securityPolicy: 'None', securityMode: 'None', description: 'Public demo OPC UA server (availability may vary).' },
    { name: 'Sample Server', endpointUrl: 'opc.tcp://opcua.demo-this.com:51210/UA/SampleServer', securityPolicy: 'None', securityMode: 'None', description: 'Community demo server (availability may vary).' }
  ]
};