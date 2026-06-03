"""
One-off script: export the full AI analyst prompt for SCMA to a markdown file.
Fetches context bundle + sector template + domain notes from Supabase,
then assembles SYSTEM_PROMPT + user_prompt and writes to docs/scma_ai_prompt.md
"""

import json
import os
import sys

# Allow imports from python/ root
sys.path.insert(0, os.path.dirname(__file__))

from utils.supabase_client import get_client
from scripts.scoring.ai_analyst import SYSTEM_PROMPT, build_user_prompt

TICKER = "SCMA"
OUT_FILE = os.path.join(os.path.dirname(__file__), "..", "docs", "scma_ai_prompt.md")


def main():
    client = get_client()

    # 1. Fetch context bundle from ai_context_cache
    resp = client.table("ai_context_cache").select("*").eq("ticker", TICKER).single().execute()
    if not resp.data:
        print(f"ERROR: No context bundle found for {TICKER}")
        sys.exit(1)
    row = resp.data
    context_bundle = row.get("context_json") or {}
    if isinstance(context_bundle, str):
        context_bundle = json.loads(context_bundle)
    print(f"Context bundle fetched for {TICKER} (built_at={row.get('built_at', '?')}, data_as_of={row.get('data_as_of', '?')})")

    # 2. Fetch sector template — use sub_sector from context bundle or stocks table
    sub_sector = context_bundle.get("sub_sector") or ""
    sector_template = None
    if sub_sector:
        st_resp = client.table("sector_templates").select("*").eq("subsector", sub_sector).limit(1).execute()
        if st_resp.data:
            sector_template = st_resp.data[0]
            print(f"Sector template found: {sub_sector}")
        else:
            print(f"No sector template for subsector: {sub_sector}")

    # 3. Fetch domain notes from domain_notes or stock_notes table
    domain_notes = None
    for table_name in ("domain_notes", "stock_notes"):
        try:
            dn_resp = client.table(table_name).select("notes").eq("ticker", TICKER).limit(1).execute()
            if dn_resp.data and dn_resp.data[0].get("notes"):
                domain_notes = dn_resp.data[0]["notes"]
                print(f"Domain notes found in {table_name}")
                break
        except Exception:
            pass
    if not domain_notes:
        print("No domain notes found")

    # 4. Macro context from bundle (context_builder embeds it)
    macro_context = context_bundle.get("macro_context")
    if not macro_context:
        # Fall back to shared/macro-context.json
        try:
            from scripts.scoring.config import get_macro_context
            macro_context = get_macro_context()
            print("Macro context loaded from shared/macro-context.json")
        except Exception as e:
            print(f"Warning: could not load macro context: {e}")

    # 5. Build the prompts
    user_prompt = build_user_prompt(
        context_json=context_bundle,
        sector_template=sector_template,
        macro_context=macro_context,
        domain_notes=domain_notes,
    )

    # 6. Write to markdown file
    out_path = os.path.abspath(OUT_FILE)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"# SCMA AI Analysis — Full Prompt Export\n\n")
        f.write(f"*Context built_at: {row.get('built_at', 'unknown')} | data_as_of: {row.get('data_as_of', 'unknown')}*\n\n")
        f.write("---\n\n")
        f.write("## SYSTEM PROMPT\n\n")
        f.write("```\n")
        f.write(SYSTEM_PROMPT)
        f.write("\n```\n\n")
        f.write("---\n\n")
        f.write("## USER PROMPT\n\n")
        f.write("```\n")
        f.write(user_prompt)
        f.write("\n```\n")

    print(f"\nExported to: {out_path}")
    print(f"System prompt: {len(SYSTEM_PROMPT):,} chars")
    print(f"User prompt:   {len(user_prompt):,} chars")


if __name__ == "__main__":
    main()
