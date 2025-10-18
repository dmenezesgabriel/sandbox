# Markdown + SQL + Web Components

Write your markdown here and see it rendered in real-time!

```sql name='summary' hide=true
SELECT
SUM(sales) as total_sales,
AVG(sales) as avg_sales,
COUNT(*) as num_products
FROM (
SELECT 'Product A' as product, 100 as sales
UNION ALL SELECT 'Product B', 150
UNION ALL SELECT 'Product C', 120
) t
```

<data-card data-ref='summary'></data-card>

```sql name='productList' hide=true
SELECT DISTINCT product
FROM (
  SELECT 'Product A' as product, 100 as sales, 'Q1' as quarter
  UNION ALL SELECT 'Product B', 150, 'Q1'
  UNION ALL SELECT 'Product C', 120, 'Q1'
  UNION ALL SELECT 'Product A', 130, 'Q2'
  UNION ALL SELECT 'Product B', 180, 'Q2'
  UNION ALL SELECT 'Product C', 140, 'Q2'
) t
ORDER BY product
```

<dropdown-component data-ref='productList' name='productSelection'></dropdown-component>

```sql name='salesData' hide=true
WITH source_data AS (
  SELECT 'Product A' as product, 100 as sales, 'Q1' as quarter
  UNION ALL SELECT 'Product B', 150, 'Q1'
  UNION ALL SELECT 'Product C', 120, 'Q1'
  UNION ALL SELECT 'Product A', 130, 'Q2'
  UNION ALL SELECT 'Product B', 180, 'Q2'
  UNION ALL SELECT 'Product C', 140, 'Q2'
)
SELECT * FROM source_data
WHERE {{input.productSelection}} = []
  OR product IN (SELECT unnest({{input.productSelection}}))
```

<vegalite-chart
  spec='{"$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "description": "Sales by Product and Quarter",
  "mark": "bar",
  "encoding": {
    "x": {"field": "product", "type": "nominal", "title": "Product"},
    "y": {"field": "sales", "type": "quantitative", "title": "Sales"},
    "color": {"field": "quarter", "type": "nominal", "title": "Quarter"}
  }}'
  data-ref='salesData'>
</vegalite-chart>

<data-table-component data-ref='salesData'></data-table-component>
