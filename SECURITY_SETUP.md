# 🔐 Security Setup Guide

## API Key Management

This project requires API keys for various services. **NEVER commit real API keys to Git.**

### Required API Keys

1. **OpenRouter API Key** - For AI model access
2. **OpenAI API Key** - For OpenAI models
3. **Twitter/Discord/Telegram Keys** - For social media platform integration

### Setup Instructions

#### Method 1: Using Environment Variables (Recommended)

1. Create a `.env` file in the project root (already in .gitignore):
```bash
cp .env.example .env
```

2. Edit `.env` and add your real API keys:
```env
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
OPENAI_API_KEY=sk-proj-your-actual-key-here
TWITTER_USERNAME=your_twitter_username
TWITTER_PASSWORD=your_twitter_password
DISCORD_API_TOKEN=your_discord_token
TELEGRAM_BOT_TOKEN=your_telegram_token
```

#### Method 2: Using Character JSON Files (Local Development Only)

1. Copy one of the template character files:
```bash
cp characters/ceo_agilethoughtleader.v5R.json characters/my_agent.json
```

2. Edit the `secrets` section in your local file:
```json
{
  "settings": {
    "secrets": {
      "OPENROUTER_API_KEY": "sk-or-v1-your-actual-key-here",
      "OPENAI_API_KEY": "sk-proj-your-actual-key-here"
    }
  }
}
```

3. **IMPORTANT**: Add your local character file to `.gitignore` if it contains real keys:
```bash
echo "characters/my_agent.json" >> .gitignore
```

### Obtaining API Keys

#### OpenRouter API Key
1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up and navigate to API Keys section
3. Create a new API key

#### OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up and navigate to API Keys
3. Create a new API key with appropriate permissions

#### Social Media Tokens
- **Twitter**: Use your Twitter account credentials
- **Discord**: Create a bot at [Discord Developer Portal](https://discord.com/developers/applications)
- **Telegram**: Create a bot via [@BotFather](https://t.me/botfather)

### Security Checklist Before Git Push

- [ ] No real API keys in character JSON files (use placeholders like `YOUR_API_KEY_HERE`)
- [ ] `.env` file is in `.gitignore` and not tracked by Git
- [ ] Log files with user data are in `.gitignore`
- [ ] Run `git status` to verify no sensitive files are staged
- [ ] Check `git diff --cached` to review staged changes

### Verifying Your Setup

Run this command to check for accidentally committed keys:
```bash
# Check for API key patterns in staged files
git diff --cached | grep -E "sk-or-v1-|sk-proj-"

# Check for API key patterns in tracked files
git ls-files | xargs grep -l "sk-or-v1-\|sk-proj-" 2>/dev/null
```

If you find any real keys, immediately:
1. Remove them and replace with placeholders
2. Unstage the files: `git reset HEAD <file>`
3. Regenerate the compromised API keys at their respective platforms

### Emergency: Key Accidentally Pushed to Git

If you've already pushed real API keys to GitHub:

1. **Immediately revoke/regenerate the exposed keys** on their respective platforms
2. Remove them from Git history:
```bash
# Use BFG Repo-Cleaner or git-filter-repo
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <file-with-keys>" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: Coordinate with team)
git push origin --force --all
```

3. Notify your team about the security incident
4. Monitor your API usage for any suspicious activity

## Additional Security Measures

### 1. File Permissions
```bash
chmod 600 .env  # Only owner can read/write
```

### 2. Git Hooks (Optional)
Create `.git/hooks/pre-commit` to prevent accidental commits:
```bash
#!/bin/bash
if git diff --cached | grep -E "sk-or-v1-[a-zA-Z0-9]{32,}|sk-proj-[a-zA-Z0-9_-]{100,}"; then
    echo "ERROR: Potential API key found in staged changes!"
    exit 1
fi
```

### 3. Environment-Specific Configs
- Use `.env.development` for development
- Use `.env.production` for production
- Never commit any `.env.*` files

## Support

If you have security concerns or found a vulnerability, please:
1. Do NOT create a public GitHub issue
2. Contact the maintainer directly
3. Follow responsible disclosure practices

