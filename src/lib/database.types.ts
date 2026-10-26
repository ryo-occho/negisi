export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      staff_sessions: {
        Row: { user_id: string; staff_id: string };
        Insert: { user_id: string; staff_id: string };
        Update: { user_id?: string; staff_id?: string };
        Relationships: [];
      };
      shift_schedule_drafts: {
        Row: {
          period_id: string;
          entries: Json;
          requirements: Json;
          version: number;
          published_version: number;
          updated_by: string;
          updated_at: string;
        };
        Insert: {
          period_id: string;
          entries?: Json;
          requirements?: Json;
          version?: number;
          published_version?: number;
          updated_by: string;
          updated_at?: string;
        };
        Update: {
          period_id?: string;
          entries?: Json;
          requirements?: Json;
          version?: number;
          published_version?: number;
          updated_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      published_shifts: {
        Row: {
          period_id: string;
          entries: Json;
          version: number;
          updated_by: string;
          updated_at: string;
        };
        Insert: {
          period_id: string;
          entries?: Json;
          version?: number;
          updated_by: string;
          updated_at?: string;
        };
        Update: {
          period_id?: string;
          entries?: Json;
          version?: number;
          updated_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shift_availability: {
        Row: {
          period_id: string;
          slot: string;
          staff_id: string;
          work_date: string;
        };
        Insert: {
          period_id: string;
          slot: string;
          staff_id: string;
          work_date: string;
        };
        Update: {
          period_id?: string;
          slot?: string;
          staff_id?: string;
          work_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shift_availability_period_id_staff_id_fkey';
            columns: ['period_id', 'staff_id'];
            isOneToOne: false;
            referencedRelation: 'shift_submissions';
            referencedColumns: ['period_id', 'staff_id'];
          },
        ];
      };
      shift_periods: {
        Row: {
          accepting: boolean;
          deadline: string;
          ends_on: string;
          id: string;
          starts_on: string;
        };
        Insert: {
          accepting?: boolean;
          deadline: string;
          ends_on: string;
          id?: string;
          starts_on: string;
        };
        Update: {
          accepting?: boolean;
          deadline?: string;
          ends_on?: string;
          id?: string;
          starts_on?: string;
        };
        Relationships: [];
      };
      shift_submissions: {
        Row: {
          period_id: string;
          staff_id: string;
          submitted_at: string | null;
        };
        Insert: {
          period_id: string;
          staff_id: string;
          submitted_at?: string | null;
        };
        Update: {
          period_id?: string;
          staff_id?: string;
          submitted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shift_submissions_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'shift_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shift_submissions_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      staff: {
        Row: {
          can_manage_shifts: boolean;
          active: boolean;
          display_name: string;
          id: string;
        };
        Insert: {
          can_manage_shifts?: boolean;
          active?: boolean;
          display_name: string;
          id?: string;
        };
        Update: {
          can_manage_shifts?: boolean;
          active?: boolean;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      save_shift_schedule: {
        Args: {
          p_period_id: string;
          p_entries: Json;
          p_draft_version: number;
          p_published_version: number;
          p_publish: boolean;
          p_requirements: Json;
        };
        Returns: Json;
      };
      save_published_shift: {
        Args: { p_entries: Json; p_period_id: string; p_version: number };
        Returns: number;
      };
      save_shift_availability: {
        Args: { p_entries: Json; p_period_id: string; p_submit: boolean };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
