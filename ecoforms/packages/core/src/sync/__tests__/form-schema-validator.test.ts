import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isValidFieldType, normalizeFieldType, type FormFieldType } from '../schemas/form-schema-validator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('form-schema-validator', () => {
    it('reconhece composite_gallery_collector como tipo válido', () => {
        expect(isValidFieldType('composite_gallery_collector')).toBe(true);
    });

    it('não remapeia composite_gallery_collector para outro tipo', () => {
        expect(normalizeFieldType('composite_gallery_collector')).toBe('composite_gallery_collector');
    });

    it('mantém form-schema.json e VALID_FIELD_TYPES em sincronia', () => {
        const schemaPath = path.resolve(__dirname, '../schemas/form-schema.json');
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        const jsonEnum: string[] = schema.$defs.field.properties.type.enum;

        expect(jsonEnum).toContain('composite_gallery_collector');
        jsonEnum.forEach((type) => {
            expect(isValidFieldType(type)).toBe(true);
        });
    });

    it('tipo FormFieldType aceita composite_gallery_collector em tempo de compilação', () => {
        const t: FormFieldType = 'composite_gallery_collector';
        expect(t).toBe('composite_gallery_collector');
    });
});
