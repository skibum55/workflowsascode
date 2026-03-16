# n8n → OpenAPI 3 YAML Generator

Auto-generates a production-ready **OpenAPI 3.0.3** specification from n8n workflows and renders it in Swagger UI.

Supports both legacy and enhanced webhook note annotations and outputs valid YAML for downstream usage.

Adapted from https://n8n.io/workflows/4270-webhookdocs-generate-swagger-preview-of-your-active-workflows/

---

# Features

- OpenAPI 3.0.3 generation
- YAML output (not JSON)
- Swagger UI compatible
- Backward compatible with legacy annotations
- Enhanced annotation syntax
- Nested body schema support
- Path, query, and header parameters
- Multiple response codes
- Redirect responses
- Automatic response inference from `Respond to Webhook` nodes
- Fault tolerant for incomplete or malformed notes

---

# How It Works

1. Scans n8n workflows.
2. Detects `Webhook` nodes.
3. Finds reachable `Respond to Webhook` nodes.
4. Parses structured annotations from webhook notes.
5. Builds an OpenAPI 3 specification.
6. Outputs YAML.
7. Swagger UI renders the YAML spec.

---

# Supported Annotation Formats

## Parameters

```
@query <name> <type> [required|optional] <description>
@path <name> <type> required <description>
@header <name> <type> [required|optional] <description>
```

## Request Body

```
@body <name> <type> [required|optional]
@body user.name string required
@body user.address.street string required
```

## Responses

```
@response <statusCode> <contentType> <description>
```

---

# Supported Types

- string
- integer
- number
- boolean
- object
- array

---

# Example Configurations

---

## GET `/users/{userId}`

### Webhook Settings

- Method: GET
- Path: users/{userId}

### Notes

```
@path userId string required The user identifier
@query includePosts boolean optional Include posts
@header Authorization string required Bearer token

@response 200 application/json User retrieved
@response 404 application/json User not found
```

### Test with curl

```
curl -X GET "https://your-domain.com/webhook/users/123?includePosts=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## POST `/users`

### Webhook Settings

- Method: POST
- Path: users

### Notes

```
@header Authorization string required Bearer token

@body user object required
@body user.firstName string required
@body user.lastName string required
@body user.email string required
@body user.age integer optional

@response 201 application/json User created
@response 400 application/json Validation error
```

### Test with curl

```
curl -X POST "https://your-domain.com/webhook/users" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "age": 30
    }
  }'
```

---

## PUT `/users/{userId}`

### Webhook Settings

- Method: PUT
- Path: users/{userId}

### Notes

```
@path userId string required User identifier
@header Authorization string required Bearer token

@body firstName string optional
@body lastName string optional
@body email string optional
@body isActive boolean optional

@response 200 application/json User updated
@response 404 application/json User not found
```

### Test with curl

```
curl -X PUT "https://your-domain.com/webhook/users/123" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "isActive": true
  }'
```

---

## DELETE `/users/{userId}`

### Webhook Settings

- Method: DELETE
- Path: users/{userId}

### Notes

```
@path userId string required User identifier
@header Authorization string required Bearer token

@response 204 application/json User deleted
@response 404 application/json User not found
```

### Test with curl

```
curl -X DELETE "https://your-domain.com/webhook/users/123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Redirect Example

### Notes

```
@path orderId string required Order ID

@response 302 redirect Redirect to status page
```

### Test with curl

```
curl -X GET "https://your-domain.com/webhook/orders/123" -i
```

---

# Legacy Annotation Support

Legacy style still works:

```
@query email string Email address
@body name string Name of user
```

Defaults:
- Parameters required
- Body type string
- 200 application/json response

---

# Swagger UI Integration

The Code node must return raw YAML:

```
return [
  {
    json: yamlOutput
  }
];
```

HTML rendering:

```html
<script>
  const yamlText = `{{ $('Code').item.json }}`;
  const spec = jsyaml.load(yamlText);

  SwaggerUIBundle({
    spec: spec,
    dom_id: "#swagger-ui"
  });
</script>
```

---

# Output

- Valid OpenAPI 3.0.3
- YAML format
- Swagger UI compatible
- Automatically generated from live workflows

---

# Result

n8n workflows now function as a documented API platform with automatic OpenAPI 3 specification generation and live Swagger UI rendering.
