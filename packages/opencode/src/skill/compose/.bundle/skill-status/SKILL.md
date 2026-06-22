# Skill Status: View Auto-Detected Workflow Patterns

Show automatically detected repeated workflows and their readiness to become reusable skills.

## How It Works

The system monitors your sessions for repeated patterns:
- **Occurrences**: How many times a workflow was detected
- **Confidence**: How stable/predictable the pattern is (0-1)
- **Time Saved**: Estimated seconds saved per use
- **Recommended**: Whether it's ready to become a skill (confidence >= 0.7, 3+ occurrences)

## What To Do

1. Use bash to read the skill scores file: `<DATA>/skill-scores.json`
2. If the file doesn't exist or is empty, report "No patterns detected yet. Keep working and patterns will be detected automatically."
3. Otherwise, display a table of detected patterns sorted by confidence
4. For recommended patterns (confidence >= 0.7, occurrences >= 3):
   - Check if a corresponding skill already exists under `.mtycoder/skills/`
   - If not, offer to create it
5. For non-recommended patterns:
   - Show current status and how many more occurrences needed

## Output Format

```
## Detected Workflow Patterns

| Pattern | Occurrences | Confidence | Time Saved | Status |
|---------|-------------|------------|------------|--------|
| ...     | 5           | 0.85       | 30s        | ✅ Recommended |
| ...     | 2           | 0.45       | 15s        | ⏳ Needs more data |

## Recommended Actions

- Create skill: `<pattern-name>` (5 occurrences, 0.85 confidence)
```
