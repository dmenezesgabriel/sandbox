## Math Tool

### Ask

```sh
curl -X 'POST' \
  'http://localhost:8000/chat/thread/{thread_id}/ask' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou'\''re provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "type": "system"
    },
    {
      "content": "How much is 222+57?",
      "type": "human"
    }
  ],
  "thread_id": "04471a38-44d5-433d-b7b0-sadfgdgsdg"
}'
```

Output:

```json
{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "9db9d700-ef8f-4cf2-bfb8-c20fc8da461d"
    },
    {
      "content": "How much is 222+57?",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "86158669-aa11-4a7f-9d01-b93a4c1ce59a",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "add",
          "arguments": "{\"a\": 222.0, \"b\": 57.0}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--1f12dfc0-820b-458e-a680-84f23bf4eba7-0",
      "example": false,
      "tool_calls": [
        {
          "name": "add",
          "args": {
            "a": 222,
            "b": 57
          },
          "id": "b3fdd6ee-8e41-4e7a-9551-2b71623051b2",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 165,
        "output_tokens": 5,
        "total_tokens": 170,
        "input_token_details": {
          "cache_read": 0
        }
      }
    }
  ],
  "__interrupt__": [
    {
      "value": {
        "question": "Continue?",
        "tool_call": {
          "name": "add",
          "args": {
            "a": 222,
            "b": 57
          },
          "id": "b3fdd6ee-8e41-4e7a-9551-2b71623051b2",
          "type": "tool_call"
        }
      },
      "resumable": true,
      "ns": ["human_review_node:7d2bfe69-0a3f-a694-8d74-2dbcfd58692c"],
      "when": "during"
    }
  ]
}
```

### Continue

```sh
curl -X 'GET' \
  'http: //localhost:8000/chat/thread/04471a38-44d5-433d-b7b0-sadfgdgsdg/continue' \
  -H 'accept: application/json'
```

Output:

```sh
{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "9db9d700-ef8f-4cf2-bfb8-c20fc8da461d"
    },
    {
      "content": "How much is 222+57?",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "86158669-aa11-4a7f-9d01-b93a4c1ce59a",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "add",
          "arguments": "{\"a\": 222.0, \"b\": 57.0}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--1f12dfc0-820b-458e-a680-84f23bf4eba7-0",
      "example": false,
      "tool_calls": [
        {
          "name": "add",
          "args": {
            "a": 222,
            "b": 57
          },
          "id": "b3fdd6ee-8e41-4e7a-9551-2b71623051b2",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 165,
        "output_tokens": 5,
        "total_tokens": 170,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": "279",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "tool",
      "name": "add",
      "id": "7def333e-4850-44af-8a7e-5cda4aa795a8",
      "tool_call_id": "b3fdd6ee-8e41-4e7a-9551-2b71623051b2",
      "artifact": null,
      "status": "success"
    },
    {
      "content": "222 + 57 is 279.",
      "additional_kwargs": {},
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--102e31d2-83dc-48df-97cb-b2b846da8838-0",
      "example": false,
      "tool_calls": [],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 173,
        "output_tokens": 14,
        "total_tokens": 187,
        "input_token_details": {
          "cache_read": 0
        }
      }
    }
  ]
}
```

### Update

```sh
curl -X 'POST' \
  'http://localhost:8000/chat/thread/04471a38-44d5-433d-b7b0-adsfsdgdsgsgdg/update' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "args": {
    "a": 1,
    "b": 2
  }
}'
```

Output:

```json
{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "3cc969a2-b8ae-4137-90c9-9d4b9f0b9ab5"
    },
    {
      "content": "How much is 222+57?",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "a7b1a273-5f76-42aa-ad9d-416e170cf42c",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "ai",
      "name": null,
      "id": "run--7fcdc6df-2365-48f5-a030-5770a32daa76-0",
      "example": false,
      "tool_calls": [
        {
          "name": "add",
          "args": {
            "a": 1,
            "b": 2
          },
          "id": "b6c740eb-95c2-47a7-b80f-2778be098d5b",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": null
    },
    {
      "content": "3",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "tool",
      "name": "add",
      "id": "cbc7b2d7-cae1-460d-86ac-824ddfcf60d1",
      "tool_call_id": "b6c740eb-95c2-47a7-b80f-2778be098d5b",
      "artifact": null,
      "status": "success"
    },
    {
      "content": "I can add numbers together. What are the exact numbers you would like me to add?",
      "additional_kwargs": {},
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--b1111bfa-d0e7-46f3-b9c5-933ca0fd21f2-0",
      "example": false,
      "tool_calls": [],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 173,
        "output_tokens": 19,
        "total_tokens": 192,
        "input_token_details": {
          "cache_read": 0
        }
      }
    }
  ]
}
```

## List Tables Tool

### Ask

```sh
curl -X 'POST' \
  'http://localhost:8000/chat/thread/{thread_id}/ask' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou'\''re provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "type": "system"
    },
    {
      "content": "list my database tables",
      "type": "human"
    }
  ],
  "thread_id": "04471a38-44d5-433d-b7b0-2342535"
}'
```

Output:

```json
{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "9cced5eb-5a8a-4117-8f02-144334ca1ac7"
    },
    {
      "content": "list my database tables",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "d767dff7-12b6-44ad-bb40-025921502164",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "list_tables",
          "arguments": "{}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--9c23b632-ebb7-45d6-97ea-cd9845beadda-0",
      "example": false,
      "tool_calls": [
        {
          "name": "list_tables",
          "args": {},
          "id": "57d5c65c-d41b-4667-a3d7-d8af12ddc64b",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 158,
        "output_tokens": 3,
        "total_tokens": 161,
        "input_token_details": {
          "cache_read": 0
        }
      }
    }
  ],
  "__interrupt__": [
    {
      "value": {
        "question": "Continue?",
        "tool_call": {
          "name": "list_tables",
          "args": {},
          "id": "57d5c65c-d41b-4667-a3d7-d8af12ddc64b",
          "type": "tool_call"
        }
      },
      "resumable": true,
      "ns": ["human_review_node:d27d5714-5554-aee8-eea6-d426713be20a"],
      "when": "during"
    }
  ]
}
```

### Continue

```sh
curl -X 'GET' \
  'http://localhost:8000/chat/thread/04471a38-44d5-433d-b7b0-2342535/continue' \
  -H 'accept: application/json'
```

Output:

```json
{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "9cced5eb-5a8a-4117-8f02-144334ca1ac7"
    },
    {
      "content": "list my database tables",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "d767dff7-12b6-44ad-bb40-025921502164",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "list_tables",
          "arguments": "{}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--9c23b632-ebb7-45d6-97ea-cd9845beadda-0",
      "example": false,
      "tool_calls": [
        {
          "name": "list_tables",
          "args": {},
          "id": "57d5c65c-d41b-4667-a3d7-d8af12ddc64b",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 158,
        "output_tokens": 3,
        "total_tokens": 161,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": [
        "{\n  \"name\": \"test\"\n}",
        "{\n  \"name\": \"test2\"\n}",
        "{\n  \"name\": \"example\"\n}",
        "{\n  \"name\": \"user\"\n}",
        "{\n  \"name\": \"test3\"\n}"
      ],
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "tool",
      "name": "list_tables",
      "id": "9a1fb5d1-0b34-43d0-8026-e158629ad5de",
      "tool_call_id": "57d5c65c-d41b-4667-a3d7-d8af12ddc64b",
      "artifact": null,
      "status": "success"
    },
    {
      "content": "Here are the names of the tables in your database: test, test2, example, user, and test3.",
      "additional_kwargs": {},
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--7e242423-7255-4fb0-99d0-0cfb89517f3f-0",
      "example": false,
      "tool_calls": [],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 222,
        "output_tokens": 25,
        "total_tokens": 247,
        "input_token_details": {
          "cache_read": 0
        }
      }
    }
  ]
}
```

## Multiple Tools

### Ask

```sh
curl -X 'POST' \
  'http://localhost:8000/chat/thread/{thread_id}/ask' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou'\''re provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "type": "system"
    },
    {
      "content": "Can you insert a new user in table user with Id 22 and email example22@example.com?",
      "type": "human"
    }
  ],
  "thread_id": "9ad6f82d-eb0d-4012-bf7c-1245125"
}'
```

Output:

```json
{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "42cfd049-4a43-4b95-9cfe-9e2445786766"
    },
    {
      "content": "Can you list my tables?",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "461f7495-1255-4f83-84fa-4fe73949406d",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "list_tables",
          "arguments": "{}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--22bfc37d-f1da-469c-a3ef-1e4df97ecb1d-0",
      "example": false,
      "tool_calls": [
        {
          "name": "list_tables",
          "args": {},
          "id": "146b9302-8a5b-4df5-aa38-d047f42a46f1",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 160,
        "output_tokens": 3,
        "total_tokens": 163,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": [
        "{\n  \"name\": \"test\"\n}",
        "{\n  \"name\": \"test2\"\n}",
        "{\n  \"name\": \"example\"\n}",
        "{\n  \"name\": \"user\"\n}",
        "{\n  \"name\": \"test3\"\n}"
      ],
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "tool",
      "name": "list_tables",
      "id": "0b7b110d-7a7a-410c-88f7-14ee17802a91",
      "tool_call_id": "146b9302-8a5b-4df5-aa38-d047f42a46f1",
      "artifact": null,
      "status": "success"
    },
    {
      "content": "OK. I see the following tables: test, test2, example, user, and test3.",
      "additional_kwargs": {},
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--480a402b-b7bf-458f-912e-a4222dff2b29-0",
      "example": false,
      "tool_calls": [],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 224,
        "output_tokens": 22,
        "total_tokens": 246,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "7c83361a-da06-45cc-b9aa-4aa007c9e422"
    },
    {
      "content": "Can you describe the table user?",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "e2a7aca2-372a-47c9-9370-d9e7e2e892d1",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "describe_table",
          "arguments": "{\"table_name\": \"user\"}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--8b37f7c7-4f0f-4bf1-8f86-242d83c77584-0",
      "example": false,
      "tool_calls": [
        {
          "name": "describe_table",
          "args": {
            "table_name": "user"
          },
          "id": "768b2a94-99d2-4cfa-89b3-2557488e59d6",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 304,
        "output_tokens": 7,
        "total_tokens": 311,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": [
        "{\n  \"cid\": 0,\n  \"name\": \"id\",\n  \"type\": \"\",\n  \"notnull\": 0,\n  \"dflt_value\": null,\n  \"pk\": 0\n}",
        "{\n  \"cid\": 1,\n  \"name\": \"email\",\n  \"type\": \"\",\n  \"notnull\": 0,\n  \"dflt_value\": null,\n  \"pk\": 0\n}"
      ],
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "tool",
      "name": "describe_table",
      "id": "9f48cacb-0c23-439b-8951-926ff0f655d9",
      "tool_call_id": "768b2a94-99d2-4cfa-89b3-2557488e59d6",
      "artifact": null,
      "status": "success"
    },
    {
      "content": "OK. The user table has the columns id and email.",
      "additional_kwargs": {},
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--b0430471-a428-473d-a570-1cbd5a8dbe1d-0",
      "example": false,
      "tool_calls": [],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 417,
        "output_tokens": 12,
        "total_tokens": 429,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "d0e20a21-6c62-4438-afb1-ea50b4b2cbe3"
    },
    {
      "content": "Can you insert a new user in table user with Id 22 and email example22@example.com?",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "515b8940-519a-4cab-a705-890f4a950b0f",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "insert_data",
          "arguments": "{\"sql\": \"INSERT INTO user (id, email) VALUES (22, 'example22@example.com')\"}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--1dcbfe3a-aa0c-487c-a612-50385889b384-0",
      "example": false,
      "tool_calls": [
        {
          "name": "insert_data",
          "args": {
            "sql": "INSERT INTO user (id, email) VALUES (22, 'example22@example.com')"
          },
          "id": "d78280ea-da85-4af3-afb8-7cfe3749c471",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 505,
        "output_tokens": 26,
        "total_tokens": 531,
        "input_token_details": {
          "cache_read": 0
        }
      }
    }
  ],
  "__interrupt__": [
    {
      "value": {
        "type": "human_review",
        "question": "Continue?",
        "tool_call": {
          "name": "insert_data",
          "args": {
            "sql": "INSERT INTO user (id, email) VALUES (22, 'example22@example.com')"
          },
          "id": "d78280ea-da85-4af3-afb8-7cfe3749c471",
          "type": "tool_call"
        }
      },
      "resumable": true,
      "ns": ["human_review_node:e04daa92-433a-7b2f-7715-0d016e802bd7"],
      "when": "during"
    }
  ]
}
```

### Continue

```sh
curl -X 'GET' \
  'http://localhost:8000/chat/thread/9ad6f82d-eb0d-4012-bf7c-1245125/continue' \
  -H 'accept: application/json'
```

Output:

```json
{
  "messages": [
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "42cfd049-4a43-4b95-9cfe-9e2445786766"
    },
    {
      "content": "Can you list my tables?",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "461f7495-1255-4f83-84fa-4fe73949406d",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "list_tables",
          "arguments": "{}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--22bfc37d-f1da-469c-a3ef-1e4df97ecb1d-0",
      "example": false,
      "tool_calls": [
        {
          "name": "list_tables",
          "args": {},
          "id": "146b9302-8a5b-4df5-aa38-d047f42a46f1",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 160,
        "output_tokens": 3,
        "total_tokens": 163,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": [
        "{\n  \"name\": \"test\"\n}",
        "{\n  \"name\": \"test2\"\n}",
        "{\n  \"name\": \"example\"\n}",
        "{\n  \"name\": \"user\"\n}",
        "{\n  \"name\": \"test3\"\n}"
      ],
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "tool",
      "name": "list_tables",
      "id": "0b7b110d-7a7a-410c-88f7-14ee17802a91",
      "tool_call_id": "146b9302-8a5b-4df5-aa38-d047f42a46f1",
      "artifact": null,
      "status": "success"
    },
    {
      "content": "OK. I see the following tables: test, test2, example, user, and test3.",
      "additional_kwargs": {},
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--480a402b-b7bf-458f-912e-a4222dff2b29-0",
      "example": false,
      "tool_calls": [],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 224,
        "output_tokens": 22,
        "total_tokens": 246,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "7c83361a-da06-45cc-b9aa-4aa007c9e422"
    },
    {
      "content": "Can you describe the table user?",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "e2a7aca2-372a-47c9-9370-d9e7e2e892d1",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "describe_table",
          "arguments": "{\"table_name\": \"user\"}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--8b37f7c7-4f0f-4bf1-8f86-242d83c77584-0",
      "example": false,
      "tool_calls": [
        {
          "name": "describe_table",
          "args": {
            "table_name": "user"
          },
          "id": "768b2a94-99d2-4cfa-89b3-2557488e59d6",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 304,
        "output_tokens": 7,
        "total_tokens": 311,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": [
        "{\n  \"cid\": 0,\n  \"name\": \"id\",\n  \"type\": \"\",\n  \"notnull\": 0,\n  \"dflt_value\": null,\n  \"pk\": 0\n}",
        "{\n  \"cid\": 1,\n  \"name\": \"email\",\n  \"type\": \"\",\n  \"notnull\": 0,\n  \"dflt_value\": null,\n  \"pk\": 0\n}"
      ],
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "tool",
      "name": "describe_table",
      "id": "9f48cacb-0c23-439b-8951-926ff0f655d9",
      "tool_call_id": "768b2a94-99d2-4cfa-89b3-2557488e59d6",
      "artifact": null,
      "status": "success"
    },
    {
      "content": "OK. The user table has the columns id and email.",
      "additional_kwargs": {},
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--b0430471-a428-473d-a570-1cbd5a8dbe1d-0",
      "example": false,
      "tool_calls": [],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 417,
        "output_tokens": 12,
        "total_tokens": 429,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": "You are a helpful assistant. \nYou're provided with a list of tools, and a input from the user.\nYour job is to determine whether or not you have a tool which can handle the users input, or respond with plain text.\n",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "system",
      "name": null,
      "id": "d0e20a21-6c62-4438-afb1-ea50b4b2cbe3"
    },
    {
      "content": "Can you insert a new user in table user with Id 22 and email example22@example.com?",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "human",
      "name": null,
      "id": "515b8940-519a-4cab-a705-890f4a950b0f",
      "example": false
    },
    {
      "content": "",
      "additional_kwargs": {
        "function_call": {
          "name": "insert_data",
          "arguments": "{\"sql\": \"INSERT INTO user (id, email) VALUES (22, 'example22@example.com')\"}"
        }
      },
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--1dcbfe3a-aa0c-487c-a612-50385889b384-0",
      "example": false,
      "tool_calls": [
        {
          "name": "insert_data",
          "args": {
            "sql": "INSERT INTO user (id, email) VALUES (22, 'example22@example.com')"
          },
          "id": "d78280ea-da85-4af3-afb8-7cfe3749c471",
          "type": "tool_call"
        }
      ],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 505,
        "output_tokens": 26,
        "total_tokens": 531,
        "input_token_details": {
          "cache_read": 0
        }
      }
    },
    {
      "content": "Data inserted successfully.",
      "additional_kwargs": {},
      "response_metadata": {},
      "type": "tool",
      "name": "insert_data",
      "id": "b8819717-87ae-4ace-afc0-4786a34c6236",
      "tool_call_id": "d78280ea-da85-4af3-afb8-7cfe3749c471",
      "artifact": null,
      "status": "success"
    },
    {
      "content": "OK. I've inserted a new user into the user table with ID 22 and email example22@example.com.",
      "additional_kwargs": {},
      "response_metadata": {
        "prompt_feedback": {
          "block_reason": 0,
          "safety_ratings": []
        },
        "finish_reason": "STOP",
        "model_name": "gemini-2.0-flash",
        "safety_ratings": []
      },
      "type": "ai",
      "name": null,
      "id": "run--e3161b89-c3d8-4a04-a3e8-5455ed8708a7-0",
      "example": false,
      "tool_calls": [],
      "invalid_tool_calls": [],
      "usage_metadata": {
        "input_tokens": 539,
        "output_tokens": 28,
        "total_tokens": 567,
        "input_token_details": {
          "cache_read": 0
        }
      }
    }
  ]
}
```
