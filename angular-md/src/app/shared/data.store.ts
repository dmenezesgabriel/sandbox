// app/shared/data.store.ts

/**
 * A simple, framework-agnostic data store class.
 * In a real application, this would handle subscriptions, state management, etc.
 */
export class DataStore {
  // Define the structure of your dynamic data
  private data = {
    sales: {
      chart: {
        xAxisData: ['Shirt', 'Jumper', 'Cardigan', 'Jacket', 'Vest'],
        seriesData: [5, 20, 36, 10, 10],
      },
    },
    user: {
      name: 'Angular User',
    },
    // NEW: Table Data (Object of Arrays format)
    table: {
      salesData: {
        Product: ['Laptop', 'Monitor', 'Keyboard', 'Mouse'],
        Revenue: [12000, 4500, 800, 300],
        Units: [12, 18, 55, 75],
      },
      columns: [
        { field: 'Product', header: 'Item Name' },
        { field: 'Revenue', header: 'Sales ($)' },
        { field: 'Units', header: 'Qty Sold' },
      ],
    },
  };

  /**
   * Retrieves a value from the store using a dot-separated path (e.g., 'sales.chart.xAxisData').
   * @param path The dot-separated path to the data.
   * @returns The data value, or undefined.
   */
  public get(path: string): any {
    return path.split('.').reduce((obj: any, key: string) => {
      // Safely navigate the object structure
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, this.data);
  }
}
