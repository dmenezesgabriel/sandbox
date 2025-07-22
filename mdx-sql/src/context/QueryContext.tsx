import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { QueryResult } from "../hooks/useDuckDB";
import { useDuckDB } from "../hooks/useDuckDB";

// Deep comparison function for QueryResult objects
const areQueryResultsEqual = (a: QueryResult, b: QueryResult): boolean => {
  // Check basic properties
  if (a.rowCount !== b.rowCount) return false;
  if (a.columns.length !== b.columns.length) return false;
  if (a.rows.length !== b.rows.length) return false;

  // Check columns array
  for (let i = 0; i < a.columns.length; i++) {
    if (a.columns[i] !== b.columns[i]) return false;
  }

  // Check rows array (deep comparison)
  for (let i = 0; i < a.rows.length; i++) {
    const rowA = a.rows[i];
    const rowB = b.rows[i];

    if (rowA.length !== rowB.length) return false;

    for (let j = 0; j < rowA.length; j++) {
      if (rowA[j] !== rowB[j]) return false;
    }
  }

  return true;
};

interface QueryContextType {
  queryResults: Record<string, QueryResult>;
  setQueryResult: (id: string, result: QueryResult) => void;
  getQueryResult: (id: string) => QueryResult | undefined;
  db: unknown;
  inputParams: Record<string, string | number | boolean | null>;
  setInputParam: (
    name: string,
    value: string | number | boolean | null
  ) => void;
  isDbReady: boolean;
  dbError: string | null;
  executeQuery: (sql: string) => Promise<QueryResult>;
}

const QueryContext = createContext<QueryContextType | undefined>(undefined);

export const QueryProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [queryResults, setQueryResults] = useState<Record<string, QueryResult>>(
    {}
  );
  const { db, isReady: isDbReady, error: dbError, executeQuery } = useDuckDB();
  const [inputParams, setInputParams] = useState<
    Record<string, string | number | boolean | null>
  >({});

  const setQueryResult = useCallback((id: string, result: QueryResult) => {
    setQueryResults((prev) => {
      const existingResult = prev[id];
      // If no existing result or results are different, update the state
      if (!existingResult || !areQueryResultsEqual(existingResult, result)) {
        return { ...prev, [id]: result };
      }
      // Results are identical, return previous state to prevent re-render
      return prev;
    });
  }, []);

  const getQueryResult = (id: string) => {
    return queryResults[id];
  };

  const setInputParam = useCallback(
    (name: string, value: string | number | boolean | null) => {
      setInputParams((prev) => {
        if (prev[name] === value) return prev; // Prevent unnecessary re-renders

        return { ...prev, [name]: value };
      });
    },
    []
  );

  const executeQueryWithParams = useCallback(
    async (sql: string): Promise<QueryResult> => {
      if (!db) {
        throw new Error("DuckDB not initialized");
      }

      // Perform parameter substitution (use HandlerBars?)
      let processedSql = sql;
      for (const paramName in inputParams) {
        const placeholder = new RegExp(
          `\\$\\{\\s*inputs\\.${paramName}\\s*\\}`,
          "g"
        );

        processedSql = processedSql.replace(
          placeholder,
          String(inputParams[paramName])
        );
      }

      try {
        const result = await executeQuery(processedSql);
        return result;
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : "Query execution failed"
        );
      }
    },
    [db, inputParams, executeQuery]
  );

  return (
    <QueryContext.Provider
      value={{
        queryResults,
        setQueryResult,
        getQueryResult,
        db,
        isDbReady,
        dbError,
        executeQuery: executeQueryWithParams,
        inputParams,
        setInputParam,
      }}
    >
      {children}
    </QueryContext.Provider>
  );
};

export const useQueryContext = () => {
  const context = useContext(QueryContext);
  if (!context) {
    throw new Error("useQueryContext must be used within a QueryProvider");
  }
  return context;
};
