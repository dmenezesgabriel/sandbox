import { DASHBOARD_CONFIG } from '../../src/features/dashboard/model/dashboard-config.ts';
import type { DashboardConfig } from '../../src/shared/types/index.ts';
import type { NodeDuckDBManager } from './node-duckdb.ts';

// Test config mirrors production field definitions but uses in-memory table
// names (no URLs) and disables network-dependent features.
export const TEST_CONFIG: DashboardConfig = {
  ...DASHBOARD_CONFIG,
  dataSources: [
    { name: 'customer', url: '' },
    { name: 'product', url: '' },
    { name: 'sales', url: '' },
  ],
  relationships: [
    {
      left: { table: 'sales', column: 'Customer ID' },
      right: { table: 'customer', column: 'Customer ID' },
      confidence: 1,
    },
    {
      left: { table: 'sales', column: 'Product ID' },
      right: { table: 'product', column: 'Product ID' },
      confidence: 1,
    },
  ],
  askData: {
    ...DASHBOARD_CONFIG.askData,
    locale: 'en-US',
    inferRelationships: false,
    semanticMatching: { enabled: false },
  },
};

// DDL + seed data.  Dates use the "%d-%m-%Y" format expected by the field config.
const SETUP_SQL = [
  `CREATE TABLE customer ("Customer ID" VARCHAR, "Customer Name" VARCHAR, Region VARCHAR, Segment VARCHAR)`,
  `INSERT INTO customer VALUES
    ('C-001','Alice','West','Consumer'),
    ('C-002','Bob','East','Corporate'),
    ('C-003','Carol','West','Consumer'),
    ('C-004','Dave','Central','Home Office'),
    ('C-005','Eve','South','Consumer')`,
  `CREATE TABLE product ("Product ID" VARCHAR, "Product Name" VARCHAR, Category VARCHAR, "Sub-Category" VARCHAR)`,
  `INSERT INTO product VALUES
    ('P-001','Laptop Pro','Technology','Computers'),
    ('P-002','Office Chair','Furniture','Chairs'),
    ('P-003','Paper Pack','Office Supplies','Paper')`,
  `CREATE TABLE sales (
    "Order ID" VARCHAR, "Customer ID" VARCHAR, "Product ID" VARCHAR,
    "Order Date" VARCHAR, "Ship Date" VARCHAR, Sales DOUBLE
  )`,
  `INSERT INTO sales VALUES
    ('O-001','C-001','P-001','15-01-2017','20-01-2017',1200.00),
    ('O-002','C-002','P-002','20-02-2017','25-02-2017',450.00),
    ('O-003','C-003','P-003','10-03-2017','15-03-2017',180.00),
    ('O-004','C-004','P-001','15-04-2017','20-04-2017',800.00),
    ('O-005','C-005','P-002','20-05-2017','25-05-2017',320.00),
    ('O-006','C-001','P-002','10-01-2018','15-01-2018',560.00),
    ('O-007','C-002','P-001','20-02-2018','25-02-2018',950.00),
    ('O-008','C-003','P-003','10-03-2018','15-03-2018',220.00),
    ('O-009','C-004','P-002','15-04-2018','20-04-2018',380.00),
    ('O-010','C-005','P-001','20-05-2018','25-05-2018',700.00)`,
];

export async function setupTestDatabase(db: NodeDuckDBManager): Promise<void> {
  for (const sql of SETUP_SQL) await db.exec(sql);
}
