import z from "zod";

export function jsonSchemaToZod(schema: any): z.ZodObject<any> {
  if (!schema || !schema.properties) {
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(schema.required || []);

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    let field: z.ZodTypeAny;

    switch (prop.type) {
      case "string":
        if (prop.enum) {
          field = z.enum(prop.enum as [string, ...string[]]);
        } else {
          field = z.string();
        }
        break;

      case "number":
      case "integer":
        field = z.number();
        if (prop.minimum !== undefined) field = (field as z.ZodNumber).min(prop.minimum);
        if (prop.maximum !== undefined) field = (field as z.ZodNumber).max(prop.maximum);
        break;

      case "boolean":
        field = z.boolean();
        break;

      case "array":
        field = z.array(prop.items ? jsonSchemaPropertyToZod(prop.items) : z.any());
        break;

      case "object":
        field = prop.properties ? jsonSchemaToZod(prop) : z.object(z.any());
        break;

      default:
        field = z.any();
    }

    if (prop.description) {
      field = field.describe(prop.description);
    }

    if (prop.default !== undefined) {
      field = field.default(prop.default);
    }

    if (!required.has(key)) {
      field = field.optional();
    }

    shape[key] = field;
  }

  return z.object(shape);
}

export function jsonSchemaPropertyToZod(prop: any): z.ZodTypeAny {
  switch (prop.type) {
    case "string":
      return z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    default:
      return z.any();
  }
}
