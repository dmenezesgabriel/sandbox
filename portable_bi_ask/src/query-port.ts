export interface QueryPort {
  query(sql: string): Promise<unknown>;
}
