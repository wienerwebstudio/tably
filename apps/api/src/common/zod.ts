import { applyDecorators, Body, Injectable, PipeTransform, Query } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';
import { AppError } from './errors';

// Validierungsmeldungen auf Deutsch – sie werden direkt an den Formularfeldern angezeigt.
z.config(z.locales.de());

@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new AppError('validation_failed', 'Bitte prüfe deine Eingaben.', { fields });
  }
}

/** Validierter Request-Body. */
export const ZBody = <T>(schema: ZodType<T>) => Body(new ZodPipe(schema));
/** Validierte Query-Parameter. */
export const ZQuery = <T>(schema: ZodType<T>) => Query(new ZodPipe(schema));

/** Dokumentiert das Body-Schema in OpenAPI (aus dem Zod-Schema abgeleitet). */
export function ApiZodBody(schema: ZodType): MethodDecorator {
  let jsonSchema: Record<string, unknown> = { type: 'object' };
  try {
    jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    delete jsonSchema.$schema;
  } catch {
    /* Schema nicht darstellbar – generisches Objekt dokumentieren */
  }
  return applyDecorators(ApiBody({ schema: jsonSchema as never }));
}
