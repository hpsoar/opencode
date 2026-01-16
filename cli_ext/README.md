# OpenCode Interactive Session Inspector

An interactive Python tool for querying and analyzing OpenCode session data.

## Features

- ✅ View all sessions with full IDs
- ✅ Inspect message execution timeline
- ✅ Track tool calls (read, write, edit, task, etc.)
- ✅ Monitor subagent calls and child sessions
- ✅ View TODO creation and updates
- ✅ Analyze session statistics
- ✅ Search by session title, tool name, or agent

## Installation

No installation required. Just run the script with Python 3.6+:

```bash
python3 cli_ext/opencode_interactive.py
```

## Usage

### Basic Navigation

```bash
# List all sessions
> sessions

# Enter a session (copy FULL ID from table)
> session ses_43b465e63ffevDqVN2BdIUOIFn

# List messages in session
> messages

# View message details (copy FULL ID from table)
> message msg_bc4b9a19e0013nVcq8l5kogMaE

# Show execution timeline
> parts

# View TODO list
> todos

# Analyze session statistics
> analyze
```

### Search Commands

```bash
# Find sessions by title
> find-session authentication

# Find messages using a specific tool
> find-tool task

# Find messages from a specific agent
> find-agent explore
```

### Other Commands

```bash
# Clear screen
> clear

# Show help
> help

# Exit
> exit
```

## Important Notes

⚠️ **Always copy the FULL ID from the table!**

- Session IDs are 38 characters long
- Message IDs are approximately 35 characters long
- The tables now display the complete IDs
- Copy the full ID to avoid matching errors

## Data Location

Session data is stored in:
```
~/.local/share/opencode/storage/
├── session/          # Session metadata
├── message/          # Message data
├── part/             # Message parts (tool calls, etc.)
└── todo/             # TODO lists
```

## Example Workflow

```bash
# 1. Start the inspector
python3 cli_ext/opencode_interactive.py

# 2. List sessions
> sessions

# 3. Copy full session ID and enter session
> session ses_43b465e63ffevDqVN2BdIUOIFn

# 4. List messages
> messages

# 5. Copy full message ID and view details
> message msg_bc4b9a19e0013nVcq8l5kogMaE

# 6. View execution timeline
> parts

# 7. Analyze statistics
> analyze

# 8. Exit
> exit
```

## Requirements

- Python 3.6+
- Access to OpenCode storage directory (`~/.local/share/opencode/storage/`)

## Troubleshooting

### Session not found

Make sure you're copying the FULL ID from the table. The table now displays complete IDs without truncation.

### Time shows as 1970-01-01

This should be fixed in v4. If you still see this, check the timestamp format in the JSON files.

### No messages found

The session might not have any messages yet, or the session ID is incorrect.
