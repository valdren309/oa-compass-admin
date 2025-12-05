export interface AlmaIdentifier {
  id_type: { value: string };
  value: string;
  status: { value: string };
}

export interface AlmaUser {
  primary_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email?: string;
  user_group: string;
  expiry_date: string;
  identifiers: AlmaIdentifier[];
}

export interface AlmaUserLite {
  primary_id?: string;
  first_name?: string;
  last_name?: string;
  user_group?: string;
  user_group_desc?: string;
  expiry_date_fmt?: string;
  link?: string;
}