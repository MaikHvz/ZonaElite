erDiagram
    ROLES {
        int id PK
        text name "administrador, instructor, recepcion, alumno"
    }
    PROFILES {
        uuid id PK "FK a auth.users"
        int role_id FK
        text full_name
        text email
        text phone
        date birth_date
        text photo_url
        boolean active
    }
    DEPENDENTS {
        uuid id PK
        uuid tutor_id FK "-> profiles"
        text full_name
        text rut
        date birth_date
        text category "nino / adulto"
    }
    BENEFICIARIES {
        uuid id PK
        uuid profile_id FK "nullable, unique"
        uuid dependent_id FK "nullable, unique"
    }
    MEMBERSHIP_PLANS {
        uuid id PK
        text name
        numeric price
        int duration_days
        text category "adulto / nino"
        jsonb benefits
        boolean active
    }
    MEMBERSHIPS {
        uuid id PK
        uuid beneficiary_id FK
        uuid plan_id FK
        uuid purchased_by FK "-> profiles"
        date start_date
        date end_date
        text status "activa/vencida/cancelada"
    }
    PAYMENTS {
        uuid id PK
        uuid user_id FK "-> profiles (pagador)"
        uuid membership_id FK "nullable"
        uuid order_id FK "nullable"
        text concept
        numeric amount
        text method
        text status
        text receipt_url
    }
    PRODUCTS {
        uuid id PK
        text name
        text category
        text description
        numeric price
        int stock
        boolean active
    }
    PRODUCT_IMAGES {
        uuid id PK
        uuid product_id FK
        text url
        int position
    }
    PRODUCT_ORDERS {
        uuid id PK
        uuid user_id FK
        text status "borrador/enviado/confirmado"
        numeric total
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        int quantity
        numeric unit_price
    }
    MEDICAL_RECORDS {
        uuid id PK
        uuid beneficiary_id FK "unique"
        text enfermedades
        text lesiones
        text medicamentos
        text alergias
        text contacto_emergencia_nombre
        text contacto_emergencia_telefono
    }
    CONSENT_FORMS {
        uuid id PK
        uuid beneficiary_id FK
        jsonb data
        text pdf_url
        timestamptz signed_at
    }
    BODY_METRICS {
        uuid id PK
        uuid beneficiary_id FK
        date recorded_at
        numeric weight_kg
        numeric height_cm
        numeric bmi
        numeric muscle_mass_pct
        numeric body_fat_pct
    }
    DISCIPLINES {
        uuid id PK
        text name
        text color_hex
    }
    SCHEDULES {
        uuid id PK
        uuid discipline_id FK
        uuid professor_id FK "-> profiles"
        text room
        int day_of_week
        time start_time
        time end_time
        int capacity
    }
    CLASS_SESSIONS {
        uuid id PK
        uuid schedule_id FK
        date session_date
    }
    ATTENDANCE {
        uuid id PK
        uuid session_id FK
        uuid beneficiary_id FK
        text status "presente/ausente/justificado"
        uuid marked_by FK
    }
    BLOG_POSTS {
        uuid id PK
        text title
        text slug
        text content
        text cover_image
        jsonb gallery
        uuid author_id FK
        text status "borrador/programado/publicado"
        timestamptz published_at
        timestamptz scheduled_at
    }
    EVENTS {
        uuid id PK
        text type "torneo/graduacion/seminario/clase_especial"
        text title
        text description
        text image
        text location_name
        numeric location_lat
        numeric location_lng
        date event_date
        jsonb extra
    }
    NOTIFICATIONS {
        uuid id PK
        text type
        text subject
        text content
        text target
        uuid sent_by FK
        timestamptz sent_at
    }
    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        text action
        text entity
        uuid entity_id
        jsonb metadata
        timestamptz created_at
    }
    ACADEMY_SETTINGS {
        uuid id PK
        text name
        text logo_url
        text address
        text whatsapp
        jsonb social_links
        jsonb integrations
    }

    ROLES ||--o{ PROFILES : "tiene"
    PROFILES ||--o{ DEPENDENTS : "es tutor de"
    PROFILES ||--o| BENEFICIARIES : "es"
    DEPENDENTS ||--o| BENEFICIARIES : "es"
    BENEFICIARIES ||--o{ MEMBERSHIPS : "posee"
    MEMBERSHIP_PLANS ||--o{ MEMBERSHIPS : "define"
    PROFILES ||--o{ MEMBERSHIPS : "compra"
    PROFILES ||--o{ PAYMENTS : "paga"
    MEMBERSHIPS ||--o| PAYMENTS : "genera"
    PRODUCT_ORDERS ||--o| PAYMENTS : "genera"
    PROFILES ||--o{ PRODUCT_ORDERS : "crea"
    PRODUCT_ORDERS ||--o{ ORDER_ITEMS : "contiene"
    PRODUCTS ||--o{ ORDER_ITEMS : "referencia"
    PRODUCTS ||--o{ PRODUCT_IMAGES : "tiene"
    BENEFICIARIES ||--o| MEDICAL_RECORDS : "tiene"
    BENEFICIARIES ||--o{ CONSENT_FORMS : "firma"
    BENEFICIARIES ||--o{ BODY_METRICS : "registra"
    DISCIPLINES ||--o{ SCHEDULES : "se dicta en"
    PROFILES ||--o{ SCHEDULES : "instructor de"
    SCHEDULES ||--o{ CLASS_SESSIONS : "genera"
    CLASS_SESSIONS ||--o{ ATTENDANCE : "registra"
    BENEFICIARIES ||--o{ ATTENDANCE : "asiste"
    PROFILES ||--o{ BLOG_POSTS : "escribe"
    PROFILES ||--o{ NOTIFICATIONS : "envia"
    PROFILES ||--o{ AUDIT_LOGS : "genera"