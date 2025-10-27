# Deployment Guide for Intellectory AI Inventory Manager

## 🚀 Vercel Deployment

### Prerequisites
1. GitHub repository: `https://github.com/davisonmnm/intellectory.git`
2. Vercel account
3. Supabase project
4. Gemini API key

### Environment Variables Setup

In your Vercel dashboard, add these environment variables:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Deployment Steps

1. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your repository: `davisonmnm/intellectory`

2. **Configure Build Settings:**
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Add Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add all three variables listed above

4. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be available at `https://your-project-name.vercel.app`

## 🗄️ Database Setup (Supabase)

### Required Tables

Run these SQL commands in your Supabase SQL Editor:

```sql
-- 1. Daily Bin Totals Table
CREATE TABLE public.daily_bin_totals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  bin_type_id uuid NOT NULL,
  date date NOT NULL,
  opening_total integer NOT NULL DEFAULT 0,
  now_total integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_bin_totals_pkey PRIMARY KEY (id),
  CONSTRAINT daily_bin_totals_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT daily_bin_totals_bin_type_id_fkey FOREIGN KEY (bin_type_id) REFERENCES public.bin_types(id),
  CONSTRAINT daily_bin_totals_unique UNIQUE (team_id, bin_type_id, date)
);

-- 2. Our Bins Table
CREATE TABLE public.our_bins (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  bin_type_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT our_bins_pkey PRIMARY KEY (id),
  CONSTRAINT our_bins_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT our_bins_bin_type_id_fkey FOREIGN KEY (bin_type_id) REFERENCES public.bin_types(id),
  CONSTRAINT our_bins_unique UNIQUE (team_id, bin_type_id)
);

-- 3. Enhanced Audit Log
CREATE TABLE public.bin_edit_audit_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  user_id uuid,
  edit_type text NOT NULL CHECK (edit_type = ANY (ARRAY['opening_total'::text, 'now_total'::text, 'status_count'::text, 'party_balance'::text, 'our_bins'::text])),
  bin_type_id uuid,
  party_id uuid,
  status_name text,
  old_value integer,
  new_value integer,
  reason text,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bin_edit_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT bin_edit_audit_log_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT bin_edit_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT bin_edit_audit_log_bin_type_id_fkey FOREIGN KEY (bin_type_id) REFERENCES public.bin_types(id),
  CONSTRAINT bin_edit_audit_log_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.bin_parties(id)
);

-- 4. Daily Rollover Log
CREATE TABLE public.daily_rollover_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  rollover_date date NOT NULL,
  previous_date date NOT NULL,
  user_id uuid,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_rollover_log_pkey PRIMARY KEY (id),
  CONSTRAINT daily_rollover_log_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT daily_rollover_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
```

### Required Functions

```sql
-- Function to calculate Now Total
CREATE OR REPLACE FUNCTION calculate_now_total(
  p_team_id uuid,
  p_bin_type_id uuid,
  p_date date
) RETURNS integer AS $$
DECLARE
  opening_total integer;
  we_owe_total integer;
  our_bins_total integer;
  bins_lent_out_total integer;
  now_total integer;
BEGIN
  -- Get opening total for the date
  SELECT COALESCE(opening_total, 0) INTO opening_total
  FROM daily_bin_totals
  WHERE team_id = p_team_id 
    AND bin_type_id = p_bin_type_id 
    AND date = p_date;
  
  -- Get total bins we owe (positive balances in bin_balances)
  SELECT COALESCE(SUM(balance), 0) INTO we_owe_total
  FROM bin_balances
  WHERE team_id = p_team_id 
    AND bin_type_id = p_bin_type_id 
    AND balance > 0;
  
  -- Get our bins total
  SELECT COALESCE(quantity, 0) INTO our_bins_total
  FROM our_bins
  WHERE team_id = p_team_id 
    AND bin_type_id = p_bin_type_id;
  
  -- Get total bins lent out (negative balances in bin_balances)
  SELECT COALESCE(SUM(ABS(balance)), 0) INTO bins_lent_out_total
  FROM bin_balances
  WHERE team_id = p_team_id 
    AND bin_type_id = p_bin_type_id 
    AND balance < 0;
  
  -- Calculate: Opening Total + Bins We Owe + Our Bins - Bins Lent Out
  now_total := opening_total + we_owe_total + our_bins_total - bins_lent_out_total;
  
  RETURN now_total;
END;
$$ LANGUAGE plpgsql;

-- Function to perform daily rollover
CREATE OR REPLACE FUNCTION perform_daily_rollover(
  p_team_id uuid,
  p_rollover_date date,
  p_user_id uuid
) RETURNS void AS $$
DECLARE
  previous_date date;
  bin_type_record record;
BEGIN
  previous_date := p_rollover_date - INTERVAL '1 day';
  
  -- Log the rollover
  INSERT INTO daily_rollover_log (team_id, rollover_date, previous_date, user_id)
  VALUES (p_team_id, p_rollover_date, previous_date, p_user_id);
  
  -- For each bin type, set opening total = previous day's now total
  FOR bin_type_record IN 
    SELECT id FROM bin_types WHERE team_id = p_team_id
  LOOP
    -- Insert or update opening total for the new day
    INSERT INTO daily_bin_totals (team_id, bin_type_id, date, opening_total, now_total)
    VALUES (
      p_team_id, 
      bin_type_record.id, 
      p_rollover_date, 
      calculate_now_total(p_team_id, bin_type_record.id, previous_date),
      0  -- Will be calculated when needed
    )
    ON CONFLICT (team_id, bin_type_id, date) 
    DO UPDATE SET 
      opening_total = calculate_now_total(p_team_id, bin_type_record.id, previous_date),
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## 🎯 New Features

### Enhanced Bins Management System

1. **Opening Total & Now Total Rows**
   - Opening Total: Shows starting bin count for each bin type
   - Now Total: Dynamically calculated based on bin movements
   - Both rows are editable with audit logging

2. **Our Bins Card**
   - Tracks bins owned by your company
   - Real-time editing with confirmation dialogs
   - Included in Now Total calculation

3. **Daily Rollover Functionality**
   - One-click daily rollover button
   - Automatically updates Opening Totals from previous day's Now Totals
   - Preserves all party balances and movements

4. **Comprehensive Audit Trail**
   - All manual edits are logged with user, timestamp, and reason
   - Tracks changes to totals, status counts, and party balances
   - Full audit trail for compliance and debugging

5. **Real-time Updates**
   - All changes sync across related tables instantly
   - Automatic Now Total recalculation
   - Live preview of all bin movements

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npx tsc --noEmit
```

## 📱 Mobile-First Design

The app is fully responsive and optimized for mobile devices with:
- Touch-friendly interface
- Responsive tables and cards
- Mobile-optimized navigation
- PWA capabilities

## 🎨 UI/UX Features

- Clean, modern design inspired by 22softwares.com
- Minimalist interface with generous white space
- Intuitive step-by-step workflows
- Real-time feedback and confirmations
- Professional color scheme and typography
