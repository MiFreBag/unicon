// Enhanced REST Handler with OpenAPI/Swagger Support
// server/handlers/enhanced-rest-handler.js

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class EnhancedRestHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config;
    this.isConnected = false;
    this.openApiSpec = null;
    this.endpoints = [];
    this.schemas = {};
    this.security = {};
  }

  async connect() {
    try {
      // Test basic connection
      const headers = this.buildHeaders();
      await axios.get(this.config.baseUrl, { 
        headers, 
        timeout: 10000,
        validateStatus: () => true
      });
      
      this.isConnected = true;
      
      // Try to load OpenAPI spec if provided
      if (this.config.openApiUrl || this.config.openApiFile) {
        await this.loadOpenApiSpec();
      }
      
      this.broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'connected' }
      });
      
      return { 
        success: true, 
        hasOpenApi: !!this.openApiSpec,
        endpoints: this.endpoints.length 
      };
    } catch (error) {
      this.isConnected = false;
      throw new Error(`REST connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    this.isConnected = false;
    this.openApiSpec = null;
    this.endpoints = [];
    this.schemas = {};
    
    this.broadcast({
      type: 'connection_status',
      data: { connectionId: this.connectionId, status: 'disconnected' }
    });
    return { success: true };
  }

  async loadOpenApiSpec() {
    try {
      let specContent;
      
      if (this.config.openApiUrl) {
        // Load from URL
        console.log(`Loading OpenAPI spec from URL: ${this.config.openApiUrl}`);
        const response = await axios.get(this.config.openApiUrl, {
          timeout: 15000,
          headers: { 'Accept': 'application/json, application/yaml, text/yaml' }
        });
        specContent = response.data;
      } else if (this.config.openApiFile) {
        // Load from uploaded file
        const filePath = path.join(__dirname, '../uploads', this.config.openApiFile);
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        // Parse YAML or JSON
        if (this.config.openApiFile.endsWith('.yaml') || this.config.openApiFile.endsWith('.yml')) {
          specContent = yaml.load(fileContent);
        } else {
          specContent = JSON.parse(fileContent);
        }
      }
      
      if (specContent) {
        this.openApiSpec = specContent;
        this.parseOpenApiSpec();
        console.log(`OpenAPI spec loaded: ${this.endpoints.length} endpoints found`);
      }
    } catch (error) {
      console.warn(`Failed to load OpenAPI spec: ${error.message}`);
      // Don't fail connection if OpenAPI loading fails
    }
  }

  parseOpenApiSpec() {
    if (!this.openApiSpec) return;

    this.endpoints = [];
    this.schemas = this.openApiSpec.components?.schemas || {};
    this.security = this.openApiSpec.components?.securitySchemes || {};

    // Parse paths and operations
    const paths = this.openApiSpec.paths || {};
    
    for (const [pathKey, pathValue] of Object.entries(paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
      
      for (const method of methods) {
        if (pathValue[method]) {
          const operation = pathValue[method];
          
          this.endpoints.push({
            method: method.toUpperCase(),
            path: pathKey,
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags || [],
            parameters: this.parseParameters(operation.parameters, pathValue.parameters),
            requestBody: this.parseRequestBody(operation.requestBody),
            responses: operation.responses || {},
            security: operation.security || this.openApiSpec.security || [],
            deprecated: operation.deprecated || false
          });
        }
      }
    }

    // Sort endpoints by path and method
    this.endpoints.sort((a, b) => {
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      return a.method.localeCompare(b.method);
    });
  }

  parseParameters(operationParams = [], pathParams = []) {
    const allParams = [...(pathParams || []), ...(operationParams || [])];
    
    return allParams.map(param => ({
      name: param.name,
      in: param.in, // query, header, path, cookie
      required: param.required || false,
      schema: param.schema || {},
      description: param.description,
      example: param.example || param.schema?.example
    }));
  }

  parseRequestBody(requestBody) {
    if (!requestBody) return null;

    const content = requestBody.content || {};
    const schemas = {};

    for (const [mediaType, mediaContent] of Object.entries(content)) {
      schemas[mediaType] = {
        schema: mediaContent.schema || {},
        examples: mediaContent.examples || {}
      };
    }

    return {
      required: requestBody.required || false,
      description: requestBody.description,
      content: schemas
    };
  }

  async request(method, endpoint, data = null, headers = {}, params = {}) {
    if (!this.isConnected) throw new Error('Not connected');
    
    const requestHeaders = { ...this.buildHeaders(), ...headers };
    let url = `${this.config.baseUrl}${endpoint}`;
    
    // Add query parameters
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          searchParams.append(key, value);
        }
      });
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
    }
    
    const config = {
      method,
      url,
      headers: requestHeaders,
      timeout: 30000,
      maxRedirects: 5
    };
    
    // Add request body for appropriate methods
    if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.data = data;
    }
    
    const startTime = Date.now();
    
    try {
      const response = await axios(config);
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          duration,
          timestamp: new Date().toISOString(),
          request: {
            method,
            url,
            headers: requestHeaders,
            data
          }
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.response) {
        // Server responded with error status
        return {
          success: false,
          data: {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: error.response.headers,
            data: error.response.data,
            duration,
            timestamp: new Date().toISOString(),
            request: {
              method,
              url,
              headers: requestHeaders,
              data
            }
          }
        };
      } else {
        // Network or other error
        throw new Error(`Request failed: ${error.message}`);
      }
    }
  }

  // Get available endpoints from OpenAPI spec
  getEndpoints(tag = null) {
    let endpoints = this.endpoints;
    
    if (tag) {
      endpoints = endpoints.filter(ep => ep.tags.includes(tag));
    }
    
    return {
      success: true,
      data: {
        endpoints,
        tags: this.getTags(),
        hasOpenApi: !!this.openApiSpec,
        info: this.openApiSpec?.info || {}
      }
    };
  }

  getTags() {
    const tags = new Set();
    this.endpoints.forEach(ep => {
      ep.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  // Generate example request for an endpoint
  generateExampleRequest(path, method) {
    const endpoint = this.endpoints.find(ep => 
      ep.path === path && ep.method === method.toUpperCase()
    );
    
    if (!endpoint) {
      return { success: false, error: 'Endpoint not found' };
    }

    const example = {
      method: endpoint.method,
      path: endpoint.path,
      headers: {},
      queryParams: {},
      pathParams: {},
      body: null
    };

    // Generate example parameters
    endpoint.parameters?.forEach(param => {
      const exampleValue = this.generateExampleValue(param.schema, param.example);
      
      switch (param.in) {
        case 'query':
          example.queryParams[param.name] = exampleValue;
          break;
        case 'header':
          example.headers[param.name] = exampleValue;
          break;
        case 'path':
          example.pathParams[param.name] = exampleValue;
          example.path = example.path.replace(`{${param.name}}`, exampleValue);
          break;
      }
    });

    // Generate example request body
    if (endpoint.requestBody) {
      const contentTypes = Object.keys(endpoint.requestBody.content);
      const primaryContentType = contentTypes.find(ct => ct.includes('json')) || contentTypes[0];
      
      if (primaryContentType) {
        const schema = endpoint.requestBody.content[primaryContentType].schema;
        example.body = this.generateExampleValue(schema);
        example.headers['Content-Type'] = primaryContentType;
      }
    }

    return { success: true, data: example };
  }

  generateExampleValue(schema, providedExample = null) {
    if (providedExample !== null && providedExample !== undefined) {
      return providedExample;
    }

    if (!schema) return null;

    // Handle $ref
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      const refSchema = this.schemas[refPath];
      if (refSchema) {
        return this.generateExampleValue(refSchema);
      }
    }

    // Handle arrays
    if (schema.type === 'array') {
      const itemExample = this.generateExampleValue(schema.items);
      return [itemExample];
    }

    // Handle objects
    if (schema.type === 'object' || schema.properties) {
      const obj = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([key, propSchema]) => {
          obj[key] = this.generateExampleValue(propSchema);
        });
      }
      return obj;
    }

    // Handle primitives
    switch (schema.type) {
      case 'string':
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'date') return '2024-01-01';
        if (schema.format === 'date-time') return '2024-01-01T12:00:00Z';
        if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
        if (schema.enum) return schema.enum[0];
        return schema.example || 'example string';
      
      case 'number':
      case 'integer':
        return schema.example || 42;
      
      case 'boolean':
        return schema.example !== undefined ? schema.example : true;
      
      default:
        return schema.example || null;
    }
  }

  // Validate request against OpenAPI spec
  validateRequest(path, method, headers = {}, params = {}, body = null) {
    const endpoint = this.endpoints.find(ep => 
      ep.path === path && ep.method === method.toUpperCase()
    );
    
    if (!endpoint) {
      return { valid: false, errors: ['Endpoint not found in OpenAPI specification'] };
    }

    const errors = [];

    // Validate required parameters
    endpoint.parameters?.forEach(param => {
      if (param.required) {
        let value;
        switch (param.in) {
          case 'query':
            value = params[param.name];
            break;
          case 'header':
            value = headers[param.name];
            break;
          case 'path':
            // Path params should be in the URL
            break;
        }

        if (value === null || value === undefined || value === '') {
          errors.push(`Required parameter '${param.name}' (${param.in}) is missing`);
        }
      }
    });

    // Validate request body
    if (endpoint.requestBody?.required && !body) {
      errors.push('Request body is required but not provided');
    }

    return {
      valid: errors.length === 0,
      errors,
      endpoint: {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags
      }
    };
  }

  buildHeaders() {
    const headers = {};
    
    // Default headers
    if (this.config.headers) {
      try {
        Object.assign(headers, JSON.parse(this.config.headers));
      } catch (error) {
        console.warn('Invalid headers JSON:', error);
      }
    }
    
    // Authentication headers
    switch (this.config.authentication) {
      case 'Bearer Token':
        if (this.config.token) {
          headers['Authorization'] = `Bearer ${this.config.token}`;
        }
        break;
      case 'API Key':
        if (this.config.token) {
          headers['X-API-Key'] = this.config.token;
        }
        break;
      case 'Basic Auth':
        if (this.config.token) {
          // Expect token in format "username:password"
          headers['Authorization'] = `Basic ${Buffer.from(this.config.token).toString('base64')}`;
        }
        break;
    }
    
    return headers;
  }

  broadcast(message) {
    // Placeholder for WebSocket broadcasting
    // Should be implemented by the main server
    if (global.broadcast) {
      global.broadcast(message);
    }
  }

  // File upload handling for OpenAPI specs
  static async handleFileUpload(file, filename) {
    const uploadsDir = path.join(__dirname, '../uploads');
    
    // Ensure uploads directory exists
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
    
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file);
    
    return filename;
  }

  // Cleanup uploaded files
  static async cleanupFile(filename) {
    try {
      const filePath = path.join(__dirname, '../uploads', filename);
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Failed to cleanup file ${filename}:`, error.message);
    }
  }
}

module.exports = EnhancedRestHandler;