#!/usr/bin/env python3
"""
OpenCode Interactive Session Inspector v6

Fixed version that correctly loads parts from separate part files.
"""

import os
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from collections import defaultdict


class OpenCodeInspector:
    """Interactive inspector for OpenCode session data."""
    
    def __init__(self, storage_dir: Optional[str] = None):
        """Initialize the inspector."""
        if storage_dir:
            self.storage_dir = Path(storage_dir)
        else:
            self.storage_dir = Path.home() / ".local" / "share" / "opencode" / "storage"
        
        if not self.storage_dir.exists():
            print(f"❌ Storage directory not found: {self.storage_dir}")
            sys.exit(1)
        
        self.current_session: Optional[str] = None
        self.current_message: Optional[str] = None
    
    def list_sessions(self, limit: int = 50) -> List[Dict[str, Any]]:
        """List all sessions with their metadata."""
        sessions = []
        session_dir = self.storage_dir / "session"
        
        if not session_dir.exists():
            return sessions
        
        # Find all session files (including nested project directories)
        for session_file in session_dir.glob("**/*.json"):
            try:
                with open(session_file, 'r') as f:
                    data = json.load(f)
                    sessions.append(data)
            except Exception as e:
                print(f"⚠️  Error reading {session_file}: {e}")
        
        # Sort by creation time
        sessions.sort(key=lambda x: x.get('time', {}).get('created', 0), reverse=True)
        return sessions[:limit]
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session details by ID."""
        # Search for session file in all project directories
        for session_file in self.storage_dir.glob(f"session/**/{session_id}.json"):
            try:
                with open(session_file, 'r') as f:
                    return json.load(f)
            except Exception:
                continue
        return None
    
    def list_messages(self, session_id: str) -> List[Dict[str, Any]]:
        """List all messages in a session."""
        messages = []
        message_dir = self.storage_dir / "message" / session_id
        
        if not message_dir.exists():
            return messages
        
        for msg_file in sorted(message_dir.glob("*.json")):
            try:
                with open(msg_file, 'r') as f:
                    data = json.load(f)
                    messages.append(data)
            except Exception as e:
                print(f"⚠️  Error reading {msg_file}: {e}")
        
        # Sort by creation time
        messages.sort(key=lambda x: x.get('time', {}).get('created', 0))
        return messages
    
    def get_message(self, session_id: str, message_id: str) -> Optional[Dict[str, Any]]:
        """Get message details by ID."""
        msg_file = self.storage_dir / "message" / session_id / f"{message_id}.json"
        
        if not msg_file.exists():
            return None
        
        try:
            with open(msg_file, 'r') as f:
                return json.load(f)
        except Exception:
            return None
    
    def get_parts(self, message_id: str) -> List[Dict[str, Any]]:
        """Get all parts for a message from separate part files."""
        parts = []
        part_dir = self.storage_dir / "part" / message_id
        
        if not part_dir.exists():
            return []
        
        for part_file in sorted(part_dir.glob("*.json")):
            try:
                with open(part_file, 'r') as f:
                    data = json.load(f)
                    parts.append(data)
            except Exception as e:
                print(f"⚠️  Error reading {part_file}: {e}")
        
        return parts
    
    def get_todos(self, session_id: str) -> List[Dict[str, Any]]:
        """Get TODO list for a session."""
        todo_file = self.storage_dir / "todo" / f"{session_id}.json"
        
        if not todo_file.exists():
            return []
        
        try:
            with open(todo_file, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    
    def format_timestamp(self, timestamp: int) -> str:
        """Format Unix timestamp to readable string."""
        try:
            # Check if timestamp is in milliseconds or seconds
            if timestamp > 1_000_000_000_000:  # milliseconds
                return datetime.fromtimestamp(timestamp / 1000).strftime("%Y-%m-%d %H:%M:%S")
            else:  # seconds
                return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
        except:
            return "N/A"
    
    def format_duration(self, start: int, end: int) -> str:
        """Format duration in milliseconds."""
        if not start or not end:
            return "N/A"
        duration = end - start
        if duration > 1000:
            return f"{duration/1000:.2f}s"
        return f"{duration}ms"
    
    def get_message_summary(self, message: Dict[str, Any]) -> str:
        """Get a summary of message parts and content."""
        # Load parts from separate files
        message_id = message.get('id')
        parts = self.get_parts(message_id) if message_id else []
        
        if not parts:
            return "No parts"
        
        # Count part types
        part_types = defaultdict(int)
        tool_count = 0
        text_count = 0
        
        for part in parts:
            part_type = part.get('type', 'unknown')
            part_types[part_type] += 1
            
            if part_type == 'tool':
                tool_count += 1
            elif part_type == 'text':
                text_count += 1
        
        # Build summary
        summary_parts = []
        
        if tool_count > 0:
            summary_parts.append(f"{tool_count} tools")
        if text_count > 0:
            summary_parts.append(f"{text_count} text")
        
        # Add other part types
        for ptype, count in part_types.items():
            if ptype not in ['tool', 'text'] and count > 0:
                summary_parts.append(f"{count} {ptype}")
        
        if not summary_parts:
            return f"{len(parts)} parts"
        
        return ", ".join(summary_parts)
    
    def print_sessions_table(self, sessions: List[Dict[str, Any]]):
        """Print sessions in a formatted table with FULL session IDs."""
        if not sessions:
            print("No sessions found.")
            return
        
        # Calculate column widths dynamically
        max_id_len = max(len(s.get('id', 'N/A')) for s in sessions)
        max_id_len = min(max_id_len, 50)  # Cap at 50 chars
        
        print(f"\n{'Session ID':<{max_id_len}} {'Title':<35} {'Created':<20}")
        print("-" * (max_id_len + 35 + 20 + 4))
        
        for session in sessions:
            session_id = session.get('id', 'N/A')
            title = session.get('title', 'N/A')[:35]
            created = self.format_timestamp(session.get('time', {}).get('created', 0))
            print(f"{session_id:<{max_id_len}} {title:<35} {created:<20}")
    
    def print_messages_table(self, messages: List[Dict[str, Any]]):
        """Print messages in a formatted table with FULL message IDs and summary."""
        if not messages:
            print("No messages found.")
            return
        
        # Calculate column widths dynamically
        max_id_len = max(len(m.get('id', 'N/A')) for m in messages)
        max_id_len = min(max_id_len, 40)  # Cap at 40 chars
        
        print(f"\n{'Role':<10} {'Message ID':<{max_id_len}} {'Agent':<15} {'Time':<20} {'Summary':<30}")
        print("-" * (10 + max_id_len + 15 + 20 + 30 + 5))
        
        for msg in messages:
            role = msg.get('role', 'N/A')[:10]
            msg_id = msg.get('id', 'N/A')
            agent = msg.get('agent', 'N/A')[:15]
            time = self.format_timestamp(msg.get('time', {}).get('created', 0))
            summary = self.get_message_summary(msg)[:30]
            print(f"{role:<10} {msg_id:<{max_id_len}} {agent:<15} {time:<20} {summary:<30}")
    
    def print_message_details(self, message: Dict[str, Any], show_parts: bool = True):
        """Print detailed message information."""
        print("\n" + "=" * 80)
        print(f"📝 Message: {message.get('id', 'N/A')}")
        print("=" * 80)
        
        print(f"\nRole:        {message.get('role', 'N/A')}")
        print(f"Agent:       {message.get('agent', 'N/A')}")
        
        model = message.get('model', {})
        if model:
            print(f"Model:       {model.get('providerID', 'N/A')}/{model.get('modelID', 'N/A')}")
        
        print(f"Created:     {self.format_timestamp(message.get('time', {}).get('created', 0))}")
        
        # Load parts from separate files
        message_id = message.get('id')
        parts = self.get_parts(message_id) if message_id else []
        
        if parts:
            print(f"\nSummary:     {self.get_message_summary(message)}")
        else:
            print(f"\nSummary:     No parts")
        
        if show_parts:
            self.print_parts_timeline(parts)
    
    def print_parts_timeline(self, parts: List[Dict[str, Any]]):
        """Print parts in chronological order."""
        if not parts:
            print("\nNo parts found for this message.")
            return
        
        print(f"\n{'─' * 80}")
        print("⚡ Execution Timeline")
        print(f"{'─' * 80}\n")
        
        # Sort parts by ID (which is chronological)
        sorted_parts = sorted(parts, key=lambda x: x.get('id', ''))
        
        for part in sorted_parts:
            part_type = part.get('type', 'unknown')
            
            if part_type == 'tool':
                self.print_tool_part(part)
            elif part_type == 'text':
                print("📄 [TEXT] Response text generated")
            elif part_type == 'reasoning':
                print("🧠 [REASONING] Model reasoning process")
            elif part_type == 'step-start':
                print("📍 [STEP-START] New reasoning step")
            elif part_type == 'step-finish':
                print("✅ [STEP-FINISH] Reasoning step completed")
            else:
                print(f"❓ [{part_type.upper()}] Unknown part type")
            
            print()
    
    def print_tool_part(self, part: Dict[str, Any]):
        """Print tool part details."""
        tool_name = part.get('tool', 'unknown')
        state = part.get('state', {})
        status = state.get('status', 'unknown')
        
        # Status icon
        status_icons = {
            'pending': '⏳',
            'running': '🔄',
            'completed': '✅',
            'error': '❌'
        }
        icon = status_icons.get(status, '❓')
        
        print(f"{icon} [{status.upper()}] {tool_name}")
        
        # Calculate duration
        time_info = state.get('time', {})
        if time_info.get('start') and time_info.get('end'):
            duration = self.format_duration(time_info['start'], time_info['end'])
            print(f"   Duration: {duration}")
        
        # Show input
        if state.get('input'):
            print(f"   Input:")
            self.print_json(state['input'], indent=6)
        
        # Special handling for task tool (subagent)
        if tool_name == 'task':
            self.print_task_details(state.get('input', {}), part.get('metadata', {}))
        
        # Special handling for todowrite tool
        if tool_name == 'todowrite':
            self.print_todo_update(state.get('input', {}))
        
        # Show output if completed
        if status == 'completed' and state.get('output'):
            output = state.get('output', '')
            print(f"   Output:")
            if len(str(output)) > 200:
                print(f"      {str(output)[:200]}...")
            else:
                self.print_json(output, indent=6)
        
        # Show error if any
        if status == 'error' and state.get('error'):
            print(f"   Error:")
            print(f"      {state['error']}")
    
    def print_task_details(self, input_data: Dict, metadata: Dict):
        """Print subagent task details."""
        subagent = input_data.get('subagent_type', 'unknown')
        description = input_data.get('description', 'N/A')
        child_session = metadata.get('sessionId', 'N/A')
        
        print(f"   → Subagent: {subagent}")
        print(f"   → Description: {description}")
        if child_session and child_session != 'N/A':
            print(f"   → Child Session: {child_session}")
    
    def print_todo_update(self, input_data: Dict):
        """Print TODO update details."""
        todos = input_data.get('todos', [])
        print(f"   → TODO List ({len(todos)} items):")
        for todo in todos:
            status = todo.get('status', 'unknown')
            content = todo.get('content', 'N/A')
            print(f"      [{status}] {content}")
    
    def print_json(self, data: Any, indent: int = 4):
        """Print JSON data with indentation."""
        try:
            json_str = json.dumps(data, indent=2, ensure_ascii=False)
            for line in json_str.split('\n'):
                print(' ' * indent + line)
        except:
            print(' ' * indent + str(data))
    
    def print_todos(self, todos: List[Dict[str, Any]]):
        """Print TODO list."""
        if not todos:
            print("No TODO items found.")
            return
        
        print(f"\n📋 TODO List ({len(todos)} items)")
        print("-" * 80)
        
        for todo in todos:
            status = todo.get('status', 'unknown')
            content = todo.get('content', 'N/A')
            
            status_icons = {
                'pending': '⏳',
                'in_progress': '🔄',
                'completed': '✅',
                'cancelled': '❌'
            }
            icon = status_icons.get(status, '❓')
            
            print(f"{icon} [{status.upper()}] {content}")
    
    def analyze_session(self, session_id: str):
        """Analyze a session and provide statistics."""
        messages = self.list_messages(session_id)
        
        if not messages:
            print("No messages found in session.")
            return
        
        # Count tool calls
        tool_calls = defaultdict(int)
        subagent_calls = []
        todo_updates = 0
        
        for msg in messages:
            # Load parts from separate files
            message_id = msg.get('id')
            parts = self.get_parts(message_id) if message_id else []
            
            for part in parts:
                if part.get('type') == 'tool':
                    tool_name = part.get('tool')
                    tool_calls[tool_name] += 1
                    
                    if tool_name == 'task':
                        input_data = part.get('state', {}).get('input', {})
                        subagent_calls.append({
                            'subagent': input_data.get('subagent_type'),
                            'description': input_data.get('description'),
                            'child_session': part.get('metadata', {}).get('sessionId')
                        })
                    
                    if tool_name == 'todowrite':
                        todo_updates += 1
        
        print(f"\n{'─' * 80}")
        print("📊 Session Statistics")
        print(f"{'─' * 80}\n")
        
        print(f"Total Messages:  {len(messages)}")
        print(f"Total Tool Calls: {sum(tool_calls.values())}")
        print(f"TODO Updates:     {todo_updates}")
        
        print(f"\nTool Usage:")
        for tool, count in sorted(tool_calls.items(), key=lambda x: x[1], reverse=True):
            print(f"  {tool:<20} {count:>5} calls")
        
        if subagent_calls:
            print(f"\nSubagent Calls:")
            for call in subagent_calls:
                print(f"  {call['subagent']:<20} {call['description']}")
                if call.get('child_session'):
                    print(f"    → Child Session: {call['child_session']}")


def print_help():
    """Print help information."""
    print("""
OpenCode Interactive Session Inspector v6

Navigation:
  sessions [limit]      List all sessions (default: 50)
  session <id>          Show session details and set as current
  messages              List messages in current session
  message <id>          Show message details and set as current
  parts                 Show parts timeline for current message
  todos                 Show TODO list for current session
  analyze               Analyze current session statistics
  
Search:
  find-session <query>  Find sessions by title
  find-tool <name>      Find messages using a specific tool
  find-agent <name>     Find messages using a specific agent
  
Other:
  clear                 Clear screen
  help                  Show this help
  exit / quit           Exit the inspector

Examples:
  sessions              # List all sessions
  sessions 100          # List 100 sessions
  session ses_43b465e63ffevDqVN2BdIUOIFn  # Use FULL ID from table
  messages              # List messages with summary
  message msg_bc4b9a19e0013nVcq8l5kogMaE  # Use FULL ID from table
  parts                 # Show execution timeline
  find-tool task        # Find all messages using task tool
  analyze               # Show session statistics

Note: Copy the FULL ID from the table to avoid matching errors!
""")


def interactive_mode(inspector: OpenCodeInspector):
    """Run the inspector in interactive mode."""
    print("\n" + "=" * 80)
    print("🔍 OpenCode Interactive Session Inspector v6")
    print("=" * 80)
    print("\n⚠️  IMPORTANT: Always copy the FULL ID from the table!")
    print("Type 'help' for available commands or 'exit' to quit.\n")
    
    while True:
        try:
            # Build prompt
            prompt_parts = []
            if inspector.current_session:
                session_short = inspector.current_session[:25] + "..."
                prompt_parts.append(f"📁 {session_short}")
            if inspector.current_message:
                msg_short = inspector.current_message[:25] + "..."
                prompt_parts.append(f"📝 {msg_short}")
            
            prompt = "\n" + " > ".join(prompt_parts) if prompt_parts else "\n > "
            user_input = input(prompt).strip()
            
            if not user_input:
                continue
            
            parts = user_input.split()
            command = parts[0].lower()
            args = parts[1:]
            
            # Handle commands
            if command in ['exit', 'quit']:
                print("\n👋 Goodbye!")
                break
            
            elif command == 'help':
                print_help()
            
            elif command == 'clear':
                os.system('clear' if os.name != 'nt' else 'cls')
            
            elif command == 'sessions':
                limit = int(args[0]) if args and args[0].isdigit() else 50
                sessions = inspector.list_sessions(limit)
                inspector.print_sessions_table(sessions)
            
            elif command == 'session':
                if not args:
                    print("❌ Please provide a session ID")
                    print("💡 Tip: Copy the FULL ID from the 'sessions' command output")
                    continue
                
                session_id = args[0]
                
                # Try to find session by partial ID
                if len(session_id) < 38:  # Full ID is 38 chars
                    # Search for matching sessions
                    all_sessions = inspector.list_sessions(1000)
                    matches = [s for s in all_sessions if s.get('id', '').startswith(session_id)]
                    
                    if len(matches) == 0:
                        print(f"❌ No sessions found matching: {session_id}")
                        print("💡 Tip: Copy the FULL ID from the 'sessions' command output")
                        continue
                    elif len(matches) > 1:
                        print(f"❌ Multiple sessions match '{session_id}':")
                        for m in matches[:5]:
                            print(f"   {m.get('id')}")
                        print("💡 Tip: Copy the FULL ID from the 'sessions' command output")
                        continue
                    else:
                        session_id = matches[0]['id']
                        print(f"✅ Auto-matched to: {session_id}")
                
                session = inspector.get_session(session_id)
                
                if not session:
                    print(f"❌ Session not found: {session_id}")
                    continue
                
                inspector.current_session = session_id
                inspector.current_message = None
                
                print(f"\n✅ Session set: {session_id}")
                print(f"Title: {session.get('title', 'N/A')}")
                
                # Show messages
                messages = inspector.list_messages(session_id)
                if messages:
                    print(f"\nMessages: {len(messages)}")
                    inspector.print_messages_table(messages)
            
            elif command == 'messages':
                if not inspector.current_session:
                    print("❌ No session selected. Use 'session <id>' first.")
                    continue
                
                messages = inspector.list_messages(inspector.current_session)
                inspector.print_messages_table(messages)
            
            elif command == 'message':
                if not inspector.current_session:
                    print("❌ No session selected. Use 'session <id>' first.")
                    continue
                
                if not args:
                    print("❌ Please provide a message ID")
                    print("💡 Tip: Copy the FULL ID from the 'messages' command output")
                    continue
                
                message_id = args[0]
                
                # Try to find message by partial ID
                if len(message_id) < 35:  # Message IDs are around 35 chars
                    messages = inspector.list_messages(inspector.current_session)
                    matches = [m for m in messages if m.get('id', '').startswith(message_id)]
                    
                    if len(matches) == 0:
                        print(f"❌ No messages found matching: {message_id}")
                        print("💡 Tip: Copy the FULL ID from the 'messages' command output")
                        continue
                    elif len(matches) > 1:
                        print(f"❌ Multiple messages match '{message_id}':")
                        for m in matches[:5]:
                            print(f"   {m.get('id')}")
                        print("💡 Tip: Copy the FULL ID from the 'messages' command output")
                        continue
                    else:
                        message_id = matches[0]['id']
                        print(f"✅ Auto-matched to: {message_id}")
                
                message = inspector.get_message(inspector.current_session, message_id)
                
                if not message:
                    print(f"❌ Message not found: {message_id}")
                    continue
                
                inspector.current_message = message_id
                inspector.print_message_details(message)
            
            elif command == 'parts':
                if not inspector.current_message:
                    print("❌ No message selected. Use 'message <id>' first.")
                    continue
                
                message = inspector.get_message(inspector.current_session, inspector.current_message)
                if message:
                    inspector.print_parts_timeline(message.get('parts', []))
            
            elif command == 'todos':
                if not inspector.current_session:
                    print("❌ No session selected. Use 'session <id>' first.")
                    continue
                
                todos = inspector.get_todos(inspector.current_session)
                inspector.print_todos(todos)
            
            elif command == 'analyze':
                if not inspector.current_session:
                    print("❌ No session selected. Use 'session <id>' first.")
                    continue
                
                inspector.analyze_session(inspector.current_session)
            
            elif command == 'find-session':
                if not args:
                    print("❌ Please provide a search query")
                    continue
                
                query = ' '.join(args).lower()
                sessions = inspector.list_sessions(1000)
                
                matches = [s for s in sessions if query in s.get('title', '').lower()]
                
                if not matches:
                    print(f"❌ No sessions found matching: {query}")
                else:
                    print(f"\nFound {len(matches)} matching session(s):")
                    inspector.print_sessions_table(matches[:20])
            
            elif command == 'find-tool':
                if not args:
                    print("❌ Please provide a tool name")
                    continue
                
                tool_name = args[0]
                print(f"\n🔍 Searching for messages using tool: {tool_name}")
                
                if inspector.current_session:
                    messages = inspector.list_messages(inspector.current_session)
                    matches = []
                    
                    for msg in messages:
                        # Load parts from separate files
                        message_id = msg.get('id')
                        parts = inspector.get_parts(message_id) if message_id else []
                        
                        if any(p.get('tool') == tool_name for p in parts if p.get('type') == 'tool'):
                            matches.append(msg)
                    
                    if matches:
                        print(f"\nFound {len(matches)} message(s) in current session:")
                        inspector.print_messages_table(matches)
                    else:
                        print(f"❌ No messages found using tool: {tool_name}")
                else:
                    print("❌ No session selected. Use 'session <id>' first.")
            
            elif command == 'find-agent':
                if not args:
                    print("❌ Please provide an agent name")
                    continue
                
                agent_name = args[0]
                print(f"\n🔍 Searching for messages from agent: {agent_name}")
                
                if inspector.current_session:
                    messages = inspector.list_messages(inspector.current_session)
                    matches = [m for m in messages if m.get('agent') == agent_name]
                    
                    if matches:
                        print(f"\nFound {len(matches)} message(s) from {agent_name}:")
                        inspector.print_messages_table(matches)
                    else:
                        print(f"❌ No messages found from agent: {agent_name}")
                else:
                    print("❌ No session selected. Use 'session <id>' first.")
            
            else:
                print(f"❌ Unknown command: {command}")
                print("Type 'help' for available commands")
        
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="OpenCode Interactive Session Inspector v6",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 opencode_interactive.py                  # Interactive mode
  python3 opencode_interactive.py --storage /path   # Custom storage path
        """
    )
    
    parser.add_argument(
        '--storage',
        help='Custom storage directory path',
        default=None
    )
    
    args = parser.parse_args()
    
    # Create inspector
    inspector = OpenCodeInspector(storage_dir=args.storage)
    
    # Run interactive mode
    interactive_mode(inspector)


if __name__ == '__main__':
    main()
