export type Floor = 'Ground' | 'L1' | 'L2' | 'L3'
export type PaymentTag = 'early' | 'on-time' | 'late'

export interface Room {
  id: string
  floor: Floor
  number: string
  baseRent: number
  occupied: boolean
  tenantId?: string
  buildingId?: string
  buildingName?: string
}

export interface Tenant {
  id: string
  name: string
  phone?: string
  roomId: string
  monthlyRent: number
  dueDay: number
  startDate: string
}

export interface Payment {
  id: string
  tenantId: string
  monthsCovered: number
  periodStart: string // 'YYYY-MM'
  recordedDate: string // 'YYYY-MM-DD'
  amount: number
  daysOffset: number // negative = early, 0 = on-time, positive = late
}

export const FLOORS: Floor[] = ['Ground', 'L1', 'L2', 'L3']

export const FLOOR_LABELS: Record<Floor, string> = {
  Ground: 'Ground Floor',
  L1: 'First Floor (L1)',
  L2: 'Second Floor (L2)',
  L3: 'Third Floor (L3)',
}

export const INITIAL_ROOMS: Room[] = [
  { id: 'G01', floor: 'Ground', number: 'G01', baseRent: 65000, occupied: true,  tenantId: 't1'  },
  { id: 'G02', floor: 'Ground', number: 'G02', baseRent: 65000, occupied: true,  tenantId: 't2'  },
  { id: 'G03', floor: 'Ground', number: 'G03', baseRent: 68000, occupied: true,  tenantId: 't3'  },
  { id: 'G04', floor: 'Ground', number: 'G04', baseRent: 68000, occupied: false                  },
  { id: 'L101', floor: 'L1',   number: 'L101', baseRent: 70000, occupied: true,  tenantId: 't4'  },
  { id: 'L102', floor: 'L1',   number: 'L102', baseRent: 70000, occupied: true,  tenantId: 't5'  },
  { id: 'L103', floor: 'L1',   number: 'L103', baseRent: 72000, occupied: true,  tenantId: 't6'  },
  { id: 'L104', floor: 'L1',   number: 'L104', baseRent: 72000, occupied: true,  tenantId: 't7'  },
  { id: 'L201', floor: 'L2',   number: 'L201', baseRent: 75000, occupied: true,  tenantId: 't8'  },
  { id: 'L202', floor: 'L2',   number: 'L202', baseRent: 75000, occupied: true,  tenantId: 't9'  },
  { id: 'L203', floor: 'L2',   number: 'L203', baseRent: 78000, occupied: true,  tenantId: 't10' },
  { id: 'L204', floor: 'L2',   number: 'L204', baseRent: 78000, occupied: true,  tenantId: 't11' },
  { id: 'L301', floor: 'L3',   number: 'L301', baseRent: 80000, occupied: true,  tenantId: 't12' },
  { id: 'L302', floor: 'L3',   number: 'L302', baseRent: 80000, occupied: true,  tenantId: 't13' },
  { id: 'L303', floor: 'L3',   number: 'L303', baseRent: 80000, occupied: true,  tenantId: 't14' },
]

export const INITIAL_TENANTS: Tenant[] = [
  { id: 't1',  name: 'Mugisha Jean',       phone: '+250 788 123 456', roomId: 'G01',  monthlyRent: 65000, dueDay: 5,  startDate: '2024-03-01' },
  { id: 't2',  name: 'Uwimana Marie',      phone: '+250 789 234 567', roomId: 'G02',  monthlyRent: 65000, dueDay: 1,  startDate: '2023-11-01' },
  { id: 't3',  name: 'Habimana Claude',                               roomId: 'G03',  monthlyRent: 68000, dueDay: 10, startDate: '2024-01-01' },
  { id: 't4',  name: 'Niyonzima Pascal',   phone: '+250 788 345 678', roomId: 'L101', monthlyRent: 70000, dueDay: 3,  startDate: '2023-08-01' },
  { id: 't5',  name: 'Uwase Diane',        phone: '+250 789 456 789', roomId: 'L102', monthlyRent: 70000, dueDay: 5,  startDate: '2024-02-01' },
  { id: 't6',  name: 'Bizimana Eric',                                 roomId: 'L103', monthlyRent: 72000, dueDay: 15, startDate: '2024-05-01' },
  { id: 't7',  name: 'Kamana Aline',       phone: '+250 788 567 890', roomId: 'L104', monthlyRent: 72000, dueDay: 1,  startDate: '2023-12-01' },
  { id: 't8',  name: 'Nkurunziza Felix',   phone: '+250 789 678 901', roomId: 'L201', monthlyRent: 75000, dueDay: 7,  startDate: '2023-09-01' },
  { id: 't9',  name: 'Uwitonze Grace',                                roomId: 'L202', monthlyRent: 75000, dueDay: 5,  startDate: '2024-04-01' },
  { id: 't10', name: 'Ndayisaba Patrick',  phone: '+250 788 789 012', roomId: 'L203', monthlyRent: 78000, dueDay: 20, startDate: '2024-01-01' },
  { id: 't11', name: 'Mutuyimana Solange', phone: '+250 789 890 123', roomId: 'L204', monthlyRent: 78000, dueDay: 1,  startDate: '2023-07-01' },
  { id: 't12', name: 'Hakizimana Robert',                             roomId: 'L301', monthlyRent: 80000, dueDay: 5,  startDate: '2024-06-01' },
  { id: 't13', name: 'Ingabire Anitha',    phone: '+250 788 901 234', roomId: 'L302', monthlyRent: 80000, dueDay: 10, startDate: '2023-10-01' },
  { id: 't14', name: 'Nsabimana David',    phone: '+250 789 012 345', roomId: 'L303', monthlyRent: 80000, dueDay: 3,  startDate: '2024-03-01' },
]

// July 2026 payments — 6 tenants have paid, 8 need attention
// Today: 2026-07-19
export const INITIAL_PAYMENTS: Payment[] = [
  // July 2026
  { id: 'p1',  tenantId: 't2',  monthsCovered: 1, periodStart: '2026-07', recordedDate: '2026-07-01', amount: 65000,  daysOffset: 0  },
  { id: 'p2',  tenantId: 't4',  monthsCovered: 1, periodStart: '2026-07', recordedDate: '2026-07-01', amount: 70000,  daysOffset: -2 },
  { id: 'p3',  tenantId: 't7',  monthsCovered: 1, periodStart: '2026-07', recordedDate: '2026-06-29', amount: 72000,  daysOffset: -3 },
  { id: 'p4',  tenantId: 't9',  monthsCovered: 1, periodStart: '2026-07', recordedDate: '2026-07-05', amount: 75000,  daysOffset: 0  },
  { id: 'p5',  tenantId: 't11', monthsCovered: 1, periodStart: '2026-07', recordedDate: '2026-07-02', amount: 78000,  daysOffset: 1  },
  { id: 'p6',  tenantId: 't12', monthsCovered: 1, periodStart: '2026-07', recordedDate: '2026-07-04', amount: 80000,  daysOffset: -1 },
  // June 2026
  { id: 'p7',  tenantId: 't1',  monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-06', amount: 65000,  daysOffset: 1  },
  { id: 'p8',  tenantId: 't2',  monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-01', amount: 65000,  daysOffset: 0  },
  { id: 'p9',  tenantId: 't3',  monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-09', amount: 68000,  daysOffset: -1 },
  { id: 'p10', tenantId: 't4',  monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-02', amount: 70000,  daysOffset: -1 },
  { id: 'p11', tenantId: 't5',  monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-04', amount: 70000,  daysOffset: -1 },
  { id: 'p12', tenantId: 't6',  monthsCovered: 2, periodStart: '2026-05', recordedDate: '2026-06-18', amount: 144000, daysOffset: 3  },
  { id: 'p13', tenantId: 't7',  monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-05-29', amount: 72000,  daysOffset: -3 },
  { id: 'p14', tenantId: 't8',  monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-10', amount: 75000,  daysOffset: 3  },
  { id: 'p15', tenantId: 't9',  monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-05', amount: 75000,  daysOffset: 0  },
  { id: 'p16', tenantId: 't10', monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-18', amount: 78000,  daysOffset: -2 },
  { id: 'p17', tenantId: 't11', monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-01', amount: 78000,  daysOffset: 0  },
  { id: 'p18', tenantId: 't12', monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-04', amount: 80000,  daysOffset: -1 },
  { id: 'p19', tenantId: 't13', monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-12', amount: 80000,  daysOffset: 2  },
  { id: 'p20', tenantId: 't14', monthsCovered: 1, periodStart: '2026-06', recordedDate: '2026-06-05', amount: 80000,  daysOffset: 2  },
]
