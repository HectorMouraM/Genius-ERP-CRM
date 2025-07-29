
import Dexie, { type EntityTable } from 'dexie';

// --- Interfaces for EnvironmentDB ---

export interface Project {
  id?: number; // Auto-incremented primary key in EnvironmentDB
  clientName: string;
  description: string;
  projectType: 'Commercial' | 'Residential';
  subType?: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluído' | 'Atrasado';
  billingType: 'fixed' | 'hourly'; // Added billing type
  hourlyRate?: number; // Required only if billingType is 'hourly'
  totalValue?: number; // Required only if billingType is 'fixed'
  createdAt: Date;
  // environmentId removed, implied by the DB instance
}

export interface Stage {
  id?: number; // Auto-incremented primary key in EnvironmentDB
  projectId: number; // Foreign key to Project within the same EnvironmentDB
  name: string;
  deadline?: Date;
  order: number;
  status: 'Pendente' | 'Em Andamento' | 'Concluído' | 'Atrasado';
  accumulatedTime: number; // In seconds
}

export interface TimeEntry {
    id?: number;
    stageId: number; // Foreign key to Stage within the same EnvironmentDB
    startTime: Date;
    endTime: Date;
    duration: number; // Duration in seconds
}

export interface StageImage {
    id?: number;
    stageId: number; // Foreign key to Stage within the same EnvironmentDB
    imageData: Blob | string;
    uploadedAt: Date;
    fileName: string;
}

export interface StageTemplate {
    id?: number; // Auto-incremented primary key in EnvironmentDB
    name: string;
    order: number;
}

// Settings specific to an environment
export interface EnvironmentSettings {
    id: 1; // Singleton ID within the EnvironmentDB
    logoImage?: Blob | string; // Environment's logo
    signatureImage?: Blob | string; // Environment's default signature
    defaultHourlyRate?: number; // Environment's default rate
    deadlineWarningDays?: number;
    enableDeadlineWarning?: boolean;
    reportLayout?: 'simple' | 'detailed';
    defaultBillingType?: 'fixed' | 'hourly'; // Added: Default billing type for new projects
    requireStageDeadline?: boolean; // Added: Require deadline for stages?
    // Add other environment-specific settings here
}

// --- CRM Interfaces for EnvironmentDB ---

export interface KanbanColumn {
    id: string; // Unique string ID (e.g., 'novo-contato') within the EnvironmentDB
    statusLabel: string;
    order: number;
}

export interface Lead {
    id?: number; // Primary key in EnvironmentDB
    name: string;
    email?: string;
    phone?: string;
    source?: string;
    projectType?: 'Commercial' | 'Residential';
    subType?: string;
    notes?: string;
    responsible?: string;
    createdAt: Date;
    kanbanColumnId: string; // Foreign key to KanbanColumn.id within the same EnvironmentDB
    // environmentId removed
}

export interface Proposal {
    id?: number; // Primary key in EnvironmentDB
    leadId: number; // Foreign key to Lead within the same EnvironmentDB
    title: string;
    chargeType: 'fixed' | 'hourly';
    hourlyRate?: number;
    estimatedHours?: number;
    totalValue: number;
    status: 'Rascunho' | 'Enviada' | 'Aceita' | 'Recusada';
    description?: string;
    items?: string; // JSON string
    observations?: string;
    createdAt: Date;
    sentAt?: Date;
    files?: string; // Placeholder
     // environmentId removed
}

export interface Interaction {
    id?: number; // Primary key in EnvironmentDB
    leadId: number; // Foreign key to Lead within the same EnvironmentDB
    type: 'ligação' | 'visita' | 'reunião' | 'anotação' | 'email';
    date: Date;
    details: string;
     // environmentId removed
}

export interface Appointment {
    id?: number; // Primary key in EnvironmentDB
    leadId: number; // Foreign key to Lead within the same EnvironmentDB
    dateTime: Date;
    description: string;
    status: 'Pendente' | 'Realizado' | 'Adiado';
     // environmentId removed
}


// --- Interfaces for MainDB ---

export type EnvironmentStatus = 'Ativo' | 'Inativo';
export type EnvironmentSector = 'Arquitetura' | 'Engenharia' | 'Design Interiores' | 'Construção' | 'Outro'; // Added Sector type

export interface Environment {
    id?: number; // Primary key in MainDB
    name: string; // Nome fantasia (mandatory)
    dbName: string; // Unique name for the IndexedDB (e.g., 'GeniusERPDB_Env_1')
    companyName?: string;
    cnpj?: string;
    logo?: Blob | string; // Logo stored in MainDB, potentially copied/referenced by EnvironmentDB? Simpler to keep here.
    primaryContactName?: string;
    primaryContactEmail?: string;
    address?: string;
    phone?: string;
    sector?: EnvironmentSector; // Added: Sector for the environment
    notes?: string; // Admin notes about the environment
    status: EnvironmentStatus;
    createdAt: Date;
}

// Add 'CRM' role
export type UserRole = 'Padrão' | 'Gerente' | 'Proprietário' | 'Admin' | 'CRM';
export type UserStatus = 'Ativo' | 'Inativo';

// User definition in MainDB
export interface User {
    id?: number; // Primary key in MainDB
    name: string;
    email: string; // Globally unique email serves as login username
    passwordHash: string; // Hashed password
    role: UserRole; // Role within their assigned environment, or 'Admin' for global access
    status: UserStatus;
    jobTitle?: string; // Added: Optional job title/description
    environmentId?: number; // Foreign key to Environment in MainDB. Undefined ONLY for 'Admin' role.
    createdAt: Date;
}

// Represents the structure of the environment-specific database
export class EnvironmentDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  stages!: EntityTable<Stage, 'id'>;
  timeEntries!: EntityTable<TimeEntry, 'id'>;
  stageImages!: EntityTable<StageImage, 'id'>;
  stageTemplates!: EntityTable<StageTemplate, 'id'>;
  environmentSettings!: EntityTable<EnvironmentSettings, 'id'>; // Changed from globalSettings
  leads!: EntityTable<Lead, 'id'>;
  kanbanColumns!: EntityTable<KanbanColumn, 'id'>;
  proposals!: EntityTable<Proposal, 'id'>;
  interactions!: EntityTable<Interaction, 'id'>;
  appointments!: EntityTable<Appointment, 'id'>;

  constructor(dbName: string) {
    super(dbName);
    // Schema definition for environment-specific tables
    // Increment version to 4 for potential schema changes if needed, but no structure changes here.
    this.version(3).stores({
        projects: '++id, clientName, status, projectType, createdAt, billingType',
        stages: '++id, projectId, order, status, deadline',
        timeEntries: '++id, stageId, startTime, endTime',
        stageImages: '++id, stageId, uploadedAt',
        stageTemplates: '++id, order, name',
        environmentSettings: '&id, defaultBillingType, requireStageDeadline', // Use '&' for singleton primary key
        leads: '++id, name, kanbanColumnId, createdAt, email, phone, responsible',
        kanbanColumns: '&id, order', // Use '&' for primary key (string ID)
        proposals: '++id, leadId, status, createdAt, totalValue',
        interactions: '++id, leadId, date, type',
        appointments: '++id, leadId, dateTime, status',
    }).upgrade(tx => {
        // Upgrade logic if structural changes were made
        return tx.table('environmentSettings').where({ id: 1 }).modify(settings => {
            if (settings.defaultBillingType === undefined) settings.defaultBillingType = 'fixed';
            if (settings.requireStageDeadline === undefined) settings.requireStageDeadline = false;
        });
    });

    // Initialize default data for a newly created environment
    this.on('populate', async (tx) => {
        const settingsCount = await tx.table('environmentSettings').count();
        if (settingsCount === 0) {
            await tx.table('environmentSettings').add({
                id: 1,
                defaultHourlyRate: 120, // Example default
                deadlineWarningDays: 7,
                enableDeadlineWarning: true,
                reportLayout: 'simple',
                defaultBillingType: 'fixed', // Default for new envs
                requireStageDeadline: false, // Default for new envs
            });
            console.log(`Populated default Environment Settings for DB: ${dbName}.`);
        }

        const kanbanColumnCount = await tx.table('kanbanColumns').count();
        if (kanbanColumnCount === 0) {
           const defaultColumns: KanbanColumn[] = [
              { id: 'novo-contato', statusLabel: 'Novo contato', order: 0 },
              { id: 'qualificacao', statusLabel: 'Qualificação', order: 1 },
              { id: 'proposta-enviada', statusLabel: 'Proposta enviada', order: 2 },
              { id: 'negociacao', statusLabel: 'Em negociação', order: 3 },
              { id: 'aceito', statusLabel: 'Aceito', order: 4 },
              { id: 'convertido', statusLabel: 'Convertido em Projeto', order: 5 }, // Added Convertido
              { id: 'perdido', statusLabel: 'Perdido', order: 6 },
          ];
          await tx.table('kanbanColumns').bulkAdd(defaultColumns);
           console.log(`Populated default Kanban Columns for DB: ${dbName}.`);
        }
     });
  }
}


// Represents the main, central database
export class MainDB extends Dexie {
  environments!: EntityTable<Environment, 'id'>;
  users!: EntityTable<User, 'id'>;

  constructor() {
    super('GeniusERP_MainDB'); // Central database name
    // Version 3: Added 'CRM' role to user role enum, potentially index role if needed for filtering often
    this.version(3).stores({
      environments: '++id, &dbName, name, status, createdAt, sector',
      users: '++id, &email, role, status, createdAt, name, environmentId, jobTitle', // Added role index
    }).upgrade(tx => {
        console.log("Upgrading MainDB to version 3: added role index to users.");
    });

     // Populate initial data for the MainDB (like the global admin user)
     this.on('populate', async (tx) => {
         const userCount = await tx.table('users').count();
         if (userCount === 0) {
              const adminEmail = 'hectormouram@gmail.com';
              // **SECURITY WARNING**: Hash the password in a real application!
               const adminPasswordHash = 'Hec965tor!'; // Replace with a securely hashed password
              await tx.table('users').add({
                   name: 'Admin Global',
                   email: adminEmail,
                   passwordHash: adminPasswordHash,
                   role: 'Admin', // Explicitly 'Admin'
                   status: 'Ativo',
                   jobTitle: 'Dono do Sistema', // Add job title
                   // environmentId is undefined for Admin role
                   createdAt: new Date(),
              });
              console.log(`Populated initial Global Admin user: ${adminEmail} in MainDB.`);
         }
     });
  }
}

// --- Database Access ---

// Singleton instance of the Main Database
export const mainDb = new MainDB();

// Store instances of environment databases dynamically
const environmentDbInstances: { [dbName: string]: EnvironmentDB } = {};

// Factory function to get or create an EnvironmentDB instance
export const getEnvironmentDB = (environmentId: number): Promise<EnvironmentDB> => {
    return new Promise(async (resolve, reject) => {
        try {
            const environment = await mainDb.environments.get(environmentId);
            if (!environment) {
                return reject(new Error(`Ambiente com ID ${environmentId} não encontrado no MainDB.`));
            }
            const dbName = environment.dbName;
            if (!environmentDbInstances[dbName]) {
                 console.log(`Creating/Opening EnvironmentDB instance: ${dbName}`);
                environmentDbInstances[dbName] = new EnvironmentDB(dbName);
                 // Ensure the DB is open before resolving
                 await environmentDbInstances[dbName].open();
                 console.log(`EnvironmentDB instance ${dbName} opened successfully.`);
            } else if (!environmentDbInstances[dbName].isOpen()) {
                 console.log(`Re-opening closed EnvironmentDB instance: ${dbName}`);
                 await environmentDbInstances[dbName].open();
                 console.log(`EnvironmentDB instance ${dbName} re-opened successfully.`);
            }
            resolve(environmentDbInstances[dbName]);
        } catch (error) {
             console.error(`Erro ao obter/abrir EnvironmentDB para ID ${environmentId}:`, error);
             reject(error);
        }
    });
};


// --- Helper Functions (remain largely the same, but operate on specific DB instances) ---

// Helper to get settings from a specific EnvironmentDB
export const getEnvironmentSettings = async (db: EnvironmentDB): Promise<EnvironmentSettings> => {
    let settings = await db.environmentSettings.get(1);
    if (!settings) {
        console.log(`Configurações não encontradas para ${db.name}, inicializando padrões...`);
         const defaultSettings: EnvironmentSettings = {
              id: 1,
              defaultHourlyRate: 120,
              deadlineWarningDays: 7,
              enableDeadlineWarning: true,
              reportLayout: 'simple',
              defaultBillingType: 'fixed',
              requireStageDeadline: false,
         };
        await db.environmentSettings.put(defaultSettings);
        settings = defaultSettings;
    }
    // Ensure default values for optional fields
    settings.enableDeadlineWarning = settings.enableDeadlineWarning ?? true;
    settings.deadlineWarningDays = settings.deadlineWarningDays ?? 7;
    settings.reportLayout = settings.reportLayout ?? 'simple';
    settings.defaultBillingType = settings.defaultBillingType ?? 'fixed';
    settings.requireStageDeadline = settings.requireStageDeadline ?? false;
    return settings;
};

// Global settings are now just environment settings, fetched via getEnvironmentSettings(dbInstance)
// Keep type export if used elsewhere - defining GlobalSettings as EnvironmentSettings
export type GlobalSettings = EnvironmentSettings;


// Rename the old db export to avoid conflicts if needed, or just remove it.
// export const db = new GeniusERPDB(); // This line is now deprecated

// Example Usage (Conceptual):
// async function loadProjectData(envId: number) {
//     try {
//         const envDb = await getEnvironmentDB(envId);
//         const projects = await envDb.projects.toArray();
//         console.log(`Projects for environment ${envId}:`, projects);
//     } catch (error) {
//         console.error("Failed to load project data:", error);
//     }
// }

// Example for admin fetching user data:
// async function loadUserData(userId: number) {
//     const user = await mainDb.users.get(userId);
//     if (user && user.environmentId) {
//         // Load environment-specific data using user.environmentId
//     } else if (user && user.role === 'Admin') {
//         // Load global admin data or allow access to all environments
//     }
// }
