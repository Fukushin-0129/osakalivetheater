-- Create linkedin_connections table
CREATE TABLE IF NOT EXISTS linkedin_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  headline text,
  profile_url text,
  picture_url text,
  request_received_at timestamp with time zone NOT NULL,
  status text CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create linkedin_messages table
CREATE TABLE IF NOT EXISTS linkedin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES linkedin_connections(id) ON DELETE CASCADE,
  template_id uuid REFERENCES message_templates(id) ON DELETE SET NULL,
  message_text text NOT NULL,
  sent_at timestamp with time zone,
  delivery_status text CHECK (delivery_status IN ('draft', 'sent', 'failed')) DEFAULT 'draft',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_linkedin_connections_status ON linkedin_connections(status);
CREATE INDEX idx_linkedin_connections_received_at ON linkedin_connections(request_received_at DESC);
CREATE INDEX idx_linkedin_messages_connection_id ON linkedin_messages(connection_id);
CREATE INDEX idx_linkedin_messages_delivery_status ON linkedin_messages(delivery_status);
CREATE INDEX idx_message_templates_active ON message_templates(is_active);

-- Enable RLS (Row Level Security) if needed
ALTER TABLE linkedin_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_messages ENABLE ROW LEVEL SECURITY;
