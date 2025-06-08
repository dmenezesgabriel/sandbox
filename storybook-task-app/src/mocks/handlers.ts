import { http, HttpResponse } from "msw";
import { MockedState } from "../components/task-list/task-list.stories";

export function getTodosSuccessHandler() {
  return http.get(
    "https://jsonplaceholder.typicode.com/todos",
    ({ request }) => {
      const url = new URL(request.url);
      const userId = url.searchParams.get("userId");

      if (userId === "1") {
        return HttpResponse.json(MockedState.tasks);
      }
    }
  );
}

export function getTodosErrorHandler() {
  return http.get(
    "https://jsonplaceholder.typicode.com/todos",
    ({ request }) => {
      const url = new URL(request.url);
      const userId = url.searchParams.get("userId");

      if (userId === "1") {
        return new HttpResponse(null, { status: 403 });
      }
    }
  );
}

export const handlers = [getTodosSuccessHandler(), getTodosErrorHandler()];
