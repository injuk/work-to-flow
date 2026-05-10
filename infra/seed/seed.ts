import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'csv-parse/sync';
import { sql } from 'drizzle-orm';

import { db } from '../../src/infrastructure/repository/db/client';
import {
	StepSchemaRelations,
	WorkflowStepSchemas,
} from '../../src/infrastructure/repository/db/schema';

const here = dirname(fileURLToPath(import.meta.url));

interface WorkflowStepSchemaRow {
	Id: number;
	Name: string;
	Type: string;
	Condition: string;
	IsHidden: boolean;
}

interface StepSchemaRelationRow {
	Id: number;
	FrontSchemaId: number;
	RearSchemaId: number;
	Label: string;
}

const readCsv = (filename: string): string[][] => {
	const filepath = resolve(here, filename);
	const content = readFileSync(filepath, 'utf8');
	return parse(content, { columns: false, skip_empty_lines: true });
};

const requireCell = (row: string[], index: number, filename: string): string => {
	const value = row[index];
	if (value === undefined) {
		throw new Error(`[seed] ${filename}: row ${row.join(',')} missing column ${index}`);
	}
	return value;
};

const loadWorkflowStepSchemas = (): WorkflowStepSchemaRow[] =>
	readCsv('WorkflowStepSchemas.csv').map((row) => ({
		Id: Number(requireCell(row, 0, 'WorkflowStepSchemas.csv')),
		Name: requireCell(row, 1, 'WorkflowStepSchemas.csv'),
		Type: requireCell(row, 2, 'WorkflowStepSchemas.csv'),
		Condition: requireCell(row, 3, 'WorkflowStepSchemas.csv'),
		IsHidden: requireCell(row, 4, 'WorkflowStepSchemas.csv') === '1',
	}));

const loadStepSchemaRelations = (): StepSchemaRelationRow[] =>
	readCsv('StepSchemaRelations.csv').map((row) => ({
		Id: Number(requireCell(row, 0, 'StepSchemaRelations.csv')),
		FrontSchemaId: Number(requireCell(row, 1, 'StepSchemaRelations.csv')),
		RearSchemaId: Number(requireCell(row, 2, 'StepSchemaRelations.csv')),
		Label: requireCell(row, 3, 'StepSchemaRelations.csv'),
	}));

const seedWorkflowStepSchemas = async (rows: WorkflowStepSchemaRow[]): Promise<void> => {
	if (rows.length === 0) return;
	await db
		.insert(WorkflowStepSchemas)
		.values(rows)
		.onDuplicateKeyUpdate({
			set: {
				Name: sql.raw('VALUES(`Name`)'),
				Type: sql.raw('VALUES(`Type`)'),
				Condition: sql.raw('VALUES(`Condition`)'),
				IsHidden: sql.raw('VALUES(`IsHidden`)'),
			},
		});
};

const seedStepSchemaRelations = async (rows: StepSchemaRelationRow[]): Promise<void> => {
	if (rows.length === 0) return;
	await db
		.insert(StepSchemaRelations)
		.values(rows)
		.onDuplicateKeyUpdate({
			set: {
				FrontSchemaId: sql.raw('VALUES(`FrontSchemaId`)'),
				RearSchemaId: sql.raw('VALUES(`RearSchemaId`)'),
				Label: sql.raw('VALUES(`Label`)'),
			},
		});
};

const main = async (): Promise<void> => {
	const stepSchemas = loadWorkflowStepSchemas();
	const stepSchemaRelations = loadStepSchemaRelations();

	console.info(`[seed] WorkflowStepSchemas: upserting ${stepSchemas.length} rows`);
	await seedWorkflowStepSchemas(stepSchemas);

	console.info(`[seed] StepSchemaRelations: upserting ${stepSchemaRelations.length} rows`);
	await seedStepSchemaRelations(stepSchemaRelations);

	console.info('[seed] done');
};

main()
	.then(() => process.exit(0))
	.catch((error: unknown) => {
		console.error('[seed] failed', error);
		process.exit(1);
	});
