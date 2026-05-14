function safe(x = "") {
  return String(x).replaceAll(":", "").replaceAll("/", "|");
}

/**
 * YAML SERIALIZER (safe)
 */
function toYAML(obj, indent = 0) {
  const spaces = "  ".repeat(indent);

  if (obj === null || obj === undefined) return "";
  if (typeof obj === "string") {
    if (obj.includes(":") || obj.includes("#") || obj.includes("\n")) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  if (typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (!obj.length) return "[]";
    return obj
      .map(item => `${spaces}- ${isPrimitive(item) ? toYAML(item, indent + 1) : "\n" + toYAML(item, indent + 1)}`)
      .join("\n");
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj).filter(([_, v]) => v !== undefined);
    if (!entries.length) return "{}";

    return entries
      .map(([key, value]) => {
        if (isPrimitive(value)) {
          return `${spaces}${key}: ${toYAML(value, indent + 1)}`;
        }
        return `${spaces}${key}:\n${toYAML(value, indent + 1)}`;
      })
      .join("\n");
  }

  return "";
}

function isPrimitive(val) {
  return (
    val === null ||
    typeof val === "string" ||
    typeof val === "number" ||
    typeof val === "boolean"
  );
}

/**
 * DFS — Safe traversal
 */
function findValidTargets(connections = {}, sourceNode, potentialTargets = []) {
  if (!sourceNode) return [];

  const visited = new Set();
  const foundTargets = new Set();

  function dfs(node) {
    if (!node || visited.has(node)) return;
    visited.add(node);

    if (potentialTargets.includes(node)) {
      foundTargets.add(node);
    }

    const nodeConnections = connections[node]?.main || [];
    for (const path of nodeConnections) {
      for (const next of path || []) {
        dfs(next?.node);
      }
    }
  }

  dfs(sourceNode);
  return Array.from(foundTargets);
}

/**
 * Robust Annotation Parser
 */
function parseAnnotations(notes) {
  if (!notes || typeof notes !== "string") {
    return emptyParseResult();
  }

  const lines = notes
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.startsWith("@"));

  const parameters = [];
  const responses = {};
  const requestBodySchema = {
    type: "object",
    properties: {},
    required: []
  };

  let hasExplicitResponse = false;

  function setNestedProperty(schema, pathParts, type, required) {
    if (!pathParts.length) return;

    let current = schema;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!part) return;

      if (!current.properties[part]) {
        current.properties[part] = { type: "object", properties: {}, required: [] };
      }

      if (i === pathParts.length - 1) {
        current.properties[part] = { type: type || "string" };
        if (required && !current.required.includes(part)) {
          current.required.push(part);
        }
      } else {
        current = current.properties[part];
      }
    }
  }

  for (const line of lines) {
    try {
      const parts = line.split(/\s+/);
      const directive = parts[0];

      if (!directive) continue;

      /**
       * PARAMETERS
       */
      if (["@query", "@path", "@header"].includes(directive)) {
        if (parts.length < 2) continue;

        const name = parts[1];
        const type = parts[2] || "string";
        const maybeRequired = parts[3];
        const description =
          parts.length > 3
            ? parts.slice(
                maybeRequired === "required" || maybeRequired === "optional" ? 4 : 3
              ).join(" ")
            : "No description";

        let required = true; // legacy default

        if (maybeRequired === "required" || maybeRequired === "optional") {
          required = maybeRequired === "required";
        }

        if (directive === "@path") required = true;

        parameters.push({
          name,
          in: directive.replace("@", ""),
          required,
          description: description || "No description",
          schema: { type }
        });
      }

      /**
       * BODY
       */
      if (directive === "@body") {
        if (parts.length < 2) continue;

        const name = parts[1];
        const type = parts[2] || "string";
        const maybeRequired = parts[3];

        const required = maybeRequired === "optional" ? false : true;

        const pathParts = name.split(".");
        setNestedProperty(requestBodySchema, pathParts, type, required);
      }

      /**
       * RESPONSE
       */
      if (directive === "@response") {
        if (parts.length < 2) continue;

        hasExplicitResponse = true;

        const code = parts[1] || "200";
        const contentType = parts[2] || "application/json";
        const description = parts.slice(3).join(" ") || "Response";

        responses[code] = {
          description,
          content: contentType === "redirect"
            ? undefined
            : {
                [contentType]: {
                  schema: { type: "object" }
                }
              }
        };
      }

    } catch (err) {
      // Ignore malformed lines silently
      continue;
    }
  }

  const hasBodyProps = Object.keys(requestBodySchema.properties).length > 0;

  return {
    parameters,
    requestBody: hasBodyProps
      ? {
          content: {
            "application/json": {
              schema: cleanSchema(requestBodySchema)
            }
          }
        }
      : undefined,
    responses,
    hasExplicitResponse
  };
}

function cleanSchema(schema) {
  if (!schema.required || !schema.required.length) {
    delete schema.required;
  }
  return schema;
}

function emptyParseResult() {
  return {
    parameters: [],
    requestBody: undefined,
    responses: {},
    hasExplicitResponse: false
  };
}

/**
 * Infer legacy response safely
 */
function inferResponsesFromNodes(webhook) {
  let produces = "application/json";
  let code = "200";

  if (Array.isArray(webhook?.responses)) {
    for (const r of webhook.responses) {
      switch (r?.parameters?.respondWith) {
        case "text":
          produces = "text/plain";
          break;
        case "redirect":
          produces = "text/plain";
          code = "301";
          break;
        case "json":
          produces = "application/json";
          break;
      }
    }
  }

  return {
    [code]: {
      description: "Successful response",
      content: {
        [produces]: {
          schema: { type: "object" }
        }
      }
    }
  };
}

/**
 * BUILD OPENAPI DOCUMENT
 */
const openapi = {
  openapi: "3.0.3",
  info: {
    title: "N8N Instance API",
    version: "1.0.0",
    description: "Auto-generated OpenAPI spec from n8n workflows"
  },
  servers: [
    {
      url: `https://${$('Get Swagger').first().json?.headers?.host || "n8n.instance.com"}/webhook`
    }
  ],
  paths: {}
};

for (const item of $input.all()) {
  const nodes = item.json?.nodes || [];
  const connections = item.json?.connections || {};

  const webhooks = nodes.filter(n => n?.type === "n8n-nodes-base.webhook");
  const responseNodes = nodes.filter(n => n?.type === "n8n-nodes-base.respondToWebhook");
  const targets = responseNodes.map(r => r.name);

  for (const w of webhooks) {
    try {
      if (w?.parameters?.responseMode === "responseNode") {
        const valid = findValidTargets(connections, w.name, targets);
        w.responses = responseNodes.filter(r => valid.includes(r.name));
      }

      const path = `/${w?.parameters?.path || ""}`;
      const method = (w?.parameters?.httpMethod || "get").toLowerCase();

      if (!openapi.paths[path]) openapi.paths[path] = {};

      const { parameters, requestBody, responses, hasExplicitResponse } =
        parseAnnotations(w?.notes);

      const finalResponses = hasExplicitResponse
        ? responses
        : inferResponsesFromNodes(w);

      openapi.paths[path][method] = {
        summary: safe(w?.name || "Webhook"),
        description: `Related to workflow [${item.json?.id || "unknown"}]`,
        tags: [safe(item.json?.name || "Workflow")],
        parameters: parameters.length ? parameters : undefined,
        requestBody,
        responses: Object.keys(finalResponses).length
          ? finalResponses
          : inferResponsesFromNodes(w)
      };
    } catch (err) {
      // Skip malformed webhook safely
      continue;
    }
  }
}

const yamlOutput = toYAML(openapi);

return {
  json: {
    yamlOutput
  }
};
