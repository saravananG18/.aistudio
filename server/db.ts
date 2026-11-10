import fs from 'fs';
import path from 'path';
import { 
  User, 
  StudentQRIdentity, 
  Bus, 
  Route, 
  Trip, 
  Booking, 
  BoardingEvent, 
  EmailLog, 
  SystemSettings,
  BusIdentificationMap 
} from '../src/types/index.ts';

export interface DatabaseSchema {
  users: User[];
  student_qr_identities: StudentQRIdentity[];
  buses: Bus[];
  routes: Route[];
  trips: Trip[];
  bookings: Booking[];
  boarding_events: BoardingEvent[];
  email_logs: EmailLog[];
  settings: SystemSettings;
  bus_map: BusIdentificationMap;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cit_booker_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Generate realistic initial seed data grounded in Chennai Institute of Technology (CIT Chennai)
function getInitialSeed(): DatabaseSchema {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  // Timing windows
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twoHoursFromNow = new Date(now.getTime() + 120 * 60 * 1000).toISOString();
  const halfHourFromNow = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const threeHoursFromNow = new Date(now.getTime() + 180 * 60 * 1000).toISOString();
  const earlierToday = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

  const users: User[] = [
    {
      id: 'usr_admin_1',
      name: 'Dr. V. Sundaram (Transport Convenor)',
      email: 'transport@citchennai.net',
      role: 'admin',
      is_verified: true,
      phone: '+91 94440 12001',
      created_at: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_1',
      name: 'Muthukumar P. (Bus 1 Driver)',
      email: 'driver.muthu@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 94432 55210',
      created_at: new Date(now.getTime() - 20 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_2',
      name: 'Selvaraj K. (Bus 53 Driver)',
      email: 'driver.selvam@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 97891 33412',
      created_at: new Date(now.getTime() - 20 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_3',
      name: 'Gopalakrishnan R. (Bus 68 Driver)',
      email: 'driver.gopal@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98402 77192',
      created_at: new Date(now.getTime() - 15 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_4',
      name: 'Murugan S. (Bus 74 Driver)',
      email: 'driver.murugan@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 97904 11223',
      created_at: new Date(now.getTime() - 18 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_5',
      name: 'Rajendran M. (Bus 86 Driver)',
      email: 'driver.rajendran@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98841 88990',
      created_at: new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_6',
      name: 'Venkatesh T. (Bus 110 Driver)',
      email: 'driver.venkatesh@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 94443 66778',
      created_at: new Date(now.getTime() - 12 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_7',
      name: 'Saravanan D. (Bus 101 Driver)',
      email: 'driver.saravanan@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98410 33221',
      created_at: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_8',
      name: 'Natarajan K. (Relief Driver)',
      email: 'driver.natarajan@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 97910 55443',
      created_at: new Date(now.getTime() - 8 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_9',
      name: 'Anbarasan R. (Reserve Driver)',
      email: 'driver.anbu@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98401 22334',
      created_at: new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_10',
      name: 'Manickam S. (Reserve Driver)',
      email: 'driver.manickam@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98402 33445',
      created_at: new Date(now.getTime() - 6 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_11',
      name: 'Karthikeyan P. (Reserve Driver)',
      email: 'driver.karthik@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98403 44556',
      created_at: new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_12',
      name: 'Dhanasekaran V. (Reserve Driver)',
      email: 'driver.dhana@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98404 55667',
      created_at: new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_13',
      name: 'Senthil Kumar M. (Reserve Driver)',
      email: 'driver.senthil@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98405 66778',
      created_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_14',
      name: 'Palanisamy T. (Reserve Driver)',
      email: 'driver.palani@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98406 77889',
      created_at: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_15',
      name: 'Velmurugan A. (Reserve Driver)',
      email: 'driver.velu@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98407 88990',
      created_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_driver_16',
      name: 'Gunasekaran B. (Reserve Driver)',
      email: 'driver.guna@citchennai.net',
      role: 'driver',
      is_verified: true,
      phone: '+91 98408 99001',
      created_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_student_1',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@citchennai.net',
      role: 'student',
      is_verified: true,
      student_id_number: '22CIT042',
      phone: '+91 98940 12345',
      created_at: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_student_2',
      name: 'Ananya Rao',
      email: 'ananya.rao@citchennai.net',
      role: 'student',
      is_verified: true,
      student_id_number: '23CIT108',
      phone: '+91 94870 54321',
      created_at: new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'usr_student_3',
      name: 'Karthik V.',
      email: 'karthik.unverified@citchennai.net',
      role: 'student',
      is_verified: false,
      student_id_number: '24CIT215',
      phone: '+91 91234 56789',
      created_at: now.toISOString()
    }
  ];

  const student_qr_identities: StudentQRIdentity[] = [
    {
      id: 'qr_aarav_1',
      user_id: 'usr_student_1',
      opaque_qr_identifier: 'CIT-QR-AARAV2026-X94B',
      status: 'ACTIVE',
      created_at: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
      revoked_at: null,
      regenerated_at: null
    },
    {
      id: 'qr_ananya_1',
      user_id: 'usr_student_2',
      opaque_qr_identifier: 'CIT-QR-ANANYA2026-K73P',
      status: 'ACTIVE',
      created_at: new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString(),
      revoked_at: null,
      regenerated_at: null
    }
  ];

  // Authentic Chennai Institute of Technology Routes with Boarding Points and Times
  const routes: Route[] = [
    {
      id: 'route_1',
      route_number: 1,
      name: 'Route 1: Ennore',
      ordered_stops: [
        'Ennore Bus Stand - Depot',
        'Lift Gate',
        'Wimco Nagar Metro',
        'Ajax Bus Stand',
        'Periyar Nagar',
        'Thiruvottriyur Market',
        'Theradi',
        'Ellai Amman Koil, Thiruvottiyur',
        'N4',
        'Kasimedu Bus Stop',
        'Kalmandapam Police Station',
        'Royapuram',
        'HP Petrol Bunk'
      ],
      stop_details: [
        { stop_name: 'Ennore Bus Stand - Depot', time: '5:20 AM' },
        { stop_name: 'Lift Gate', time: '5:25 AM' },
        { stop_name: 'Wimco Nagar Metro', time: '5:30 AM' },
        { stop_name: 'Ajax Bus Stand', time: '5:30 AM' },
        { stop_name: 'Periyar Nagar', time: '5:31 AM' },
        { stop_name: 'Thiruvottriyur Market', time: '5:32 AM' },
        { stop_name: 'Theradi', time: '5:33 AM' },
        { stop_name: 'Ellai Amman Koil, Thiruvottiyur', time: '5:34 AM' },
        { stop_name: 'N4', time: '5:40 AM' },
        { stop_name: 'Kasimedu Bus Stop', time: '5:40 AM' },
        { stop_name: 'Kalmandapam Police Station', time: '5:45 AM' },
        { stop_name: 'Royapuram', time: '5:50 AM' },
        { stop_name: 'HP Petrol Bunk', time: '6:00 AM' }
      ]
    },
    {
      id: 'route_2',
      route_number: 2,
      name: 'Route 2: Tiruvottiyur',
      ordered_stops: [
        'Kaladipet Police Station',
        'Tollgate',
        'Cross Road',
        'Lakshmi Koil Bus Stop',
        'Tondiarpet Bus Depot',
        'Apollo Hospital - Tondiarpet',
        'Tondiarpet Metro'
      ],
      stop_details: [
        { stop_name: 'Kaladipet Police Station', time: '5:39 AM' },
        { stop_name: 'Tollgate', time: '5:40 AM' },
        { stop_name: 'Cross Road', time: '5:45 AM' },
        { stop_name: 'Lakshmi Koil Bus Stop', time: '5:46 AM' },
        { stop_name: 'Tondiarpet Bus Depot', time: '5:47 AM' },
        { stop_name: 'Apollo Hospital - Tondiarpet', time: '5:49 AM' },
        { stop_name: 'Tondiarpet Metro', time: '5:50 AM' }
      ]
    },
    {
      id: 'route_3',
      route_number: 3,
      name: 'Route 3: Tondiarpet & Mint',
      ordered_stops: [
        'Masthan Koil',
        'Singapore Shopping Store',
        'Cemetery Road',
        'Pencil Factory Bus Stand',
        'Mint Clock Tower',
        'Padmanabha Theatre (Movie Max)',
        'Veterinary College',
        'Thina Thandhi'
      ],
      stop_details: [
        { stop_name: 'Masthan Koil', time: '5:35 AM' },
        { stop_name: 'Singapore Shopping Store', time: '5:50 AM' },
        { stop_name: 'Cemetery Road', time: '5:53 AM' },
        { stop_name: 'Pencil Factory Bus Stand', time: '6:00 AM' },
        { stop_name: 'Mint Clock Tower', time: '6:00 AM' },
        { stop_name: 'Padmanabha Theatre', time: '6:05 AM' },
        { stop_name: 'Veterinary College', time: '6:15 AM' },
        { stop_name: 'Thina Thandhi', time: '6:17 AM' }
      ]
    },
    {
      id: 'route_4',
      route_number: 4,
      name: 'Route 4: Manali & Madhavaram',
      ordered_stops: [
        'Jothi Nagar',
        'MFL Turn',
        'Manali Market',
        'Madhavaram MMDA',
        'Veterinary University',
        'Madhavaram Milk Colony',
        'Arul Nagar Bus Stop',
        'Thappalpetti Bus Stand',
        'Moolakadai',
        'Kalpana',
        'Madhavaram Andhra Bus Stand',
        'Retteri RTO',
        'Temple School'
      ],
      stop_details: [
        { stop_name: 'Jothi Nagar', time: '5:25 AM' },
        { stop_name: 'MFL Turn', time: '5:30 AM' },
        { stop_name: 'Manali Market', time: '5:40 AM' },
        { stop_name: 'Madhavaram MMDA', time: '5:45 AM' },
        { stop_name: 'Veterinary University', time: '5:50 AM' },
        { stop_name: 'Madhavaram Milk Colony', time: '5:51 AM' },
        { stop_name: 'Arul Nagar Bus Stop', time: '5:54 AM' },
        { stop_name: 'Thappalpetti Bus Stand', time: '5:58 AM' },
        { stop_name: 'Moolakadai', time: '6:00 AM' },
        { stop_name: 'Kalpana', time: '6:05 AM' },
        { stop_name: 'Madhavaram Andhra Bus Stand', time: '6:08 AM' },
        { stop_name: 'Retteri RTO', time: '6:09 AM' },
        { stop_name: 'Temple School', time: '6:13 AM' }
      ]
    },
    {
      id: 'route_5',
      route_number: 5,
      name: 'Route 5: KKD Nagar & Otteri',
      ordered_stops: [
        'MR Nagar (Ceelam Bakery)',
        'KKD Nagar Bus Depot',
        'Sidco Kodungaiyur',
        'Kannadasan Nagar EB',
        'SK Mahal Kodungaiyur',
        'MKB Nagar',
        'Ambedkar College Vyasarpadi',
        'Jeeva Railway Station',
        'Jamaliya SPR City Binny Mill',
        'Otteri Bridge',
        'Otteri Podi Kadai',
        'TB Hospital'
      ],
      stop_details: [
        { stop_name: 'MR Nagar (Ceelam Bakery)', time: '5:40 AM' },
        { stop_name: 'KKD Nagar Bus Depot', time: '5:40 AM' },
        { stop_name: 'Sidco Kodungaiyur', time: '5:40 AM' },
        { stop_name: 'Kannadasan Nagar EB', time: '5:45 AM' },
        { stop_name: 'SK Mahal Kodungaiyur', time: '5:46 AM' },
        { stop_name: 'MKB Nagar', time: '5:50 AM' },
        { stop_name: 'Ambedkar College Vyasarpadi', time: '5:50 AM' },
        { stop_name: 'Jeeva Railway Station', time: '6:00 AM' },
        { stop_name: 'Jamaliya SPR City Binny Mill', time: '6:05 AM' },
        { stop_name: 'Otteri Bridge', time: '6:10 AM' },
        { stop_name: 'Otteri Podi Kadai', time: '6:10 AM' },
        { stop_name: 'TB Hospital', time: '6:10 AM' }
      ]
    },
    {
      id: 'route_14',
      route_number: 14,
      name: 'Route 14: Villivakkam & Anna Nagar',
      ordered_stops: [
        'Joint Office Ayanavaram',
        'ICF Bus Stand',
        'Thiruvalluvar Hall',
        'K4 Police Station',
        'Bougainvillea Park',
        'Kaveri Nagar',
        'B Block',
        'Chintamani Girias',
        'Anna Nagar Roundtana',
        'Thalappakatti Anna Nagar',
        '12th Avenue'
      ],
      stop_details: [
        { stop_name: 'Joint Office Ayanavaram', time: '6:05 AM' },
        { stop_name: 'ICF Bus Stand', time: '6:09 AM' },
        { stop_name: 'Thiruvalluvar Hall', time: '6:15 AM' },
        { stop_name: 'K4 Police Station', time: '6:16 AM' },
        { stop_name: 'Bougainvillea Park', time: '6:18 AM' },
        { stop_name: 'Kaveri Nagar', time: '6:20 AM' },
        { stop_name: 'B Block', time: '6:21 AM' },
        { stop_name: 'Chintamani Girias', time: '6:23 AM' },
        { stop_name: 'Anna Nagar Roundtana', time: '6:25 AM' },
        { stop_name: 'Thalappakatti Anna Nagar', time: '6:25 AM' },
        { stop_name: '12th Avenue', time: '6:28 AM' }
      ]
    },
    {
      id: 'route_18',
      route_number: 18,
      name: 'Route 18: Tirumangalam',
      ordered_stops: [
        'Tirumangalam EB',
        'Waves (Kalyan Jewellery)',
        'MMM Bus Stop',
        'Variety Centre',
        'Dharma Fancy',
        'Mosque Stop'
      ],
      stop_details: [
        { stop_name: 'Tirumangalam EB', time: '6:25 AM' },
        { stop_name: 'Waves (Kalyan Jewellery)', time: '6:27 AM' },
        { stop_name: 'MMM Bus Stop', time: '6:29 AM' },
        { stop_name: 'Variety Centre', time: '6:33 AM' },
        { stop_name: 'Dharma Fancy', time: '6:35 AM' },
        { stop_name: 'Mosque Stop', time: '6:37 AM' }
      ]
    },
    {
      id: 'route_53',
      route_number: 53,
      name: 'Route 53: Thiruvanmiyur & ECR',
      ordered_stops: [
        'Thiruvanmiyur Bus Depot',
        'RTO - Thiruvanmiyur',
        'Kottivakkam',
        'Palavakkam Church',
        'Palavakkam Arch',
        'Palavakkam Car Showroom',
        'Neelankarai',
        'Chinna Neelangarai',
        'Injambakkam Bus Stand',
        'Akkarai Water Tank'
      ],
      stop_details: [
        { stop_name: 'Thiruvanmiyur Bus Depot', time: '5:50 AM' },
        { stop_name: 'RTO - Thiruvanmiyur', time: '6:00 AM' },
        { stop_name: 'Kottivakkam', time: '6:05 AM' },
        { stop_name: 'Palavakkam Church', time: '6:09 AM' },
        { stop_name: 'Palavakkam Arch', time: '6:11 AM' },
        { stop_name: 'Palavakkam Car Showroom', time: '6:15 AM' },
        { stop_name: 'Neelankarai', time: '6:17 AM' },
        { stop_name: 'Chinna Neelangarai', time: '6:20 AM' },
        { stop_name: 'Injambakkam Bus Stand', time: '6:23 AM' },
        { stop_name: 'Akkarai Water Tank', time: '6:27 AM' }
      ]
    },
    {
      id: 'route_54',
      route_number: 54,
      name: 'Route 54: Sholinganallur & OMR',
      ordered_stops: [
        'Prithigara Devi Koil',
        'Sholinganallur Bus Stop',
        'Sholinganallur RTO',
        'Sholinganallur Dollar Stop',
        'Karapakkam Bus Stop',
        'Okkiyampettai',
        'Mettukuppam',
        'Seevaram Bus Stop',
        'Geetham Hotel'
      ],
      stop_details: [
        { stop_name: 'Prithigara Devi Koil', time: '6:10 AM' },
        { stop_name: 'Sholinganallur Bus Stop', time: '6:12 AM' },
        { stop_name: 'Sholinganallur RTO', time: '6:14 AM' },
        { stop_name: 'Sholinganallur Dollar Stop', time: '6:16 AM' },
        { stop_name: 'Karapakkam Bus Stop', time: '6:20 AM' },
        { stop_name: 'Okkiyampettai', time: '6:25 AM' },
        { stop_name: 'Mettukuppam', time: '6:30 AM' },
        { stop_name: 'Seevaram Bus Stop', time: '6:32 AM' },
        { stop_name: 'Geetham Hotel', time: '6:35 AM' }
      ]
    },
    {
      id: 'route_68',
      route_number: 68,
      name: 'Route 68: Velachery Baby Nagar',
      ordered_stops: [
        'Baby Nagar',
        'Tansi Nagar Bus Stop',
        'Velachery - Vijayanagar Bus Stand',
        '100 Ft Road Velachery',
        'FB Cake',
        'Murugan Kalyana Mandapam',
        'Gupta Bhawan',
        'Phoenix Mall',
        'Velachery Checkpost',
        'Opposite to Maduvankarai Bus Stand'
      ],
      stop_details: [
        { stop_name: 'Baby Nagar', time: '6:10 AM' },
        { stop_name: 'Tansi Nagar Bus Stop', time: '6:12 AM' },
        { stop_name: 'Velachery - Vijayanagar Bus Stand', time: '6:15 AM' },
        { stop_name: '100 Ft Road Velachery', time: '6:17 AM' },
        { stop_name: 'FB Cake', time: '6:20 AM' },
        { stop_name: 'Murugan Kalyana Mandapam', time: '6:22 AM' },
        { stop_name: 'Gupta Bhawan', time: '6:24 AM' },
        { stop_name: 'Phoenix Mall', time: '6:27 AM' },
        { stop_name: 'Velachery Checkpost', time: '6:29 AM' },
        { stop_name: 'Opposite to Maduvankarai Bus Stand', time: '6:31 AM' }
      ]
    },
    {
      id: 'route_74',
      route_number: 74,
      name: 'Route 74: Adyar & Guindy',
      ordered_stops: [
        'Adyar Depot',
        'Adyar BSNL',
        'Adyar Bridge Signal',
        'Ambiga Appalam',
        'Madhya Kailash',
        'IIT Madras',
        'Cancer Institute',
        'Raj Bhavan',
        'Mugalivakkam Ganga Sweets',
        'Porur Saravana Stores'
      ],
      stop_details: [
        { stop_name: 'Adyar Depot', time: '6:25 AM' },
        { stop_name: 'Adyar BSNL', time: '6:30 AM' },
        { stop_name: 'Adyar Bridge Signal', time: '6:32 AM' },
        { stop_name: 'Ambiga Appalam', time: '6:33 AM' },
        { stop_name: 'Madhya Kailash', time: '6:35 AM' },
        { stop_name: 'IIT Madras', time: '6:36 AM' },
        { stop_name: 'Cancer Institute', time: '6:37 AM' },
        { stop_name: 'Raj Bhavan', time: '6:38 AM' },
        { stop_name: 'Mugalivakkam Ganga Sweets', time: '6:54 AM' },
        { stop_name: 'Porur Saravana Stores', time: '6:55 AM' }
      ]
    },
    {
      id: 'route_81',
      route_number: 81,
      name: 'Route 81: KK Nagar',
      ordered_stops: [
        'Sivan Park',
        'KK Nagar EB',
        'MGR Nagar Market',
        'Data Udupi Hotel',
        'Ajantha',
        'Nessapakkam',
        'Pondicherry Guest House',
        'RTO Ground'
      ],
      stop_details: [
        { stop_name: 'Sivan Park', time: '6:19 AM' },
        { stop_name: 'KK Nagar EB', time: '6:21 AM' },
        { stop_name: 'MGR Nagar Market', time: '6:23 AM' },
        { stop_name: 'Data Udupi Hotel', time: '6:24 AM' },
        { stop_name: 'Ajantha', time: '6:25 AM' },
        { stop_name: 'Nessapakkam', time: '6:27 AM' },
        { stop_name: 'Pondicherry Guest House', time: '6:29 AM' },
        { stop_name: 'RTO Ground', time: '6:29 AM' }
      ]
    },
    {
      id: 'route_86',
      route_number: 86,
      name: 'Route 86: Porur',
      ordered_stops: [
        'Porur',
        'Porur EB Office',
        'Vigneshwara Nagar Signal',
        'Narayana School',
        'Madhananthapuram'
      ],
      stop_details: [
        { stop_name: 'Porur', time: '6:55 AM' },
        { stop_name: 'Porur EB Office', time: '7:00 AM' },
        { stop_name: 'Vigneshwara Nagar Signal', time: '7:02 AM' },
        { stop_name: 'Narayana School', time: '7:05 AM' },
        { stop_name: 'Madhananthapuram', time: '7:06 AM' }
      ]
    },
    {
      id: 'route_96',
      route_number: 96,
      name: 'Route 96: Tambaram Sanatorium',
      ordered_stops: [
        'GRT Jewellers, Sanatorium',
        'MEPZ',
        'Tambaram Sanatorium',
        'Sanatorium TB Hospital',
        'MIT Signal',
        'Chromepet MIT Bridge',
        'Chromepet Saravana Stores',
        'Pallavaram'
      ],
      stop_details: [
        { stop_name: 'GRT Jewellers, Sanatorium', time: '6:45 AM' },
        { stop_name: 'MEPZ', time: '6:45 AM' },
        { stop_name: 'Tambaram Sanatorium', time: '6:45 AM' },
        { stop_name: 'Sanatorium TB Hospital', time: '6:45 AM' },
        { stop_name: 'MIT Signal', time: '6:45 AM' },
        { stop_name: 'Chromepet MIT Bridge', time: '6:47 AM' },
        { stop_name: 'Chromepet Saravana Stores', time: '6:49 AM' },
        { stop_name: 'Pallavaram', time: '6:49 AM' }
      ]
    },
    {
      id: 'route_101',
      route_number: 101,
      name: 'Route 101: Kundrathur Police Station',
      ordered_stops: [
        'Police Station',
        'Sirukalathur',
        'Amman Koil',
        'Periyar Nagar',
        'Anjugam Nagar'
      ],
      stop_details: [
        { stop_name: 'Police Station', time: '7:16 AM' },
        { stop_name: 'Sirukalathur', time: '7:18 AM' },
        { stop_name: 'Amman Koil', time: '7:20 AM' },
        { stop_name: 'Periyar Nagar', time: '7:21 AM' },
        { stop_name: 'Anjugam Nagar', time: '7:22 AM' }
      ]
    },
    {
      id: 'route_110',
      route_number: 110,
      name: 'Route 110: Kundrathur 4 Road',
      ordered_stops: [
        '4 Road',
        'Santhi Jewellers',
        'Kundrathur Bus Stand',
        'Kulam'
      ],
      stop_details: [
        { stop_name: '4 Road', time: '7:08 AM' },
        { stop_name: 'Santhi Jewellers', time: '7:09 AM' },
        { stop_name: 'Kundrathur Bus Stand', time: '7:10 AM' },
        { stop_name: 'Kulam', time: '7:15 AM' }
      ]
    }
  ];

  // The route numbers are used as bus numbers!
  // e.g. Route 1 -> Bus 1, Route 2 -> Bus 2, Route 53 -> Bus 53, etc.
  const buses: Bus[] = [
    {
      id: 'bus_1',
      bus_number: 'Bus 1',
      route_number: 1,
      bus_name: 'Ennore Line',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_2',
      bus_number: 'Bus 2',
      route_number: 2,
      bus_name: 'Tiruvottiyur Line',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_3',
      bus_number: 'Bus 3',
      route_number: 3,
      bus_name: 'Tondiarpet & Mint',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_4',
      bus_number: 'Bus 4',
      route_number: 4,
      bus_name: 'Manali & Madhavaram',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_5',
      bus_number: 'Bus 5',
      route_number: 5,
      bus_name: 'KKD Nagar & Otteri',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_14',
      bus_number: 'Bus 14',
      route_number: 14,
      bus_name: 'Villivakkam & Anna Nagar',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_18',
      bus_number: 'Bus 18',
      route_number: 18,
      bus_name: 'Tirumangalam Line',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_53',
      bus_number: 'Bus 53',
      route_number: 53,
      bus_name: 'Thiruvanmiyur ECR Line',
      capacity: 36,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_54',
      bus_number: 'Bus 54',
      route_number: 54,
      bus_name: 'Sholinganallur OMR Express',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_68',
      bus_number: 'Bus 68',
      route_number: 68,
      bus_name: 'Velachery Baby Nagar',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_74',
      bus_number: 'Bus 74',
      route_number: 74,
      bus_name: 'Adyar & IIT Corridor',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_81',
      bus_number: 'Bus 81',
      route_number: 81,
      bus_name: 'KK Nagar Line',
      capacity: 28,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_86',
      bus_number: 'Bus 86',
      route_number: 86,
      bus_name: 'Porur Line',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_96',
      bus_number: 'Bus 96',
      route_number: 96,
      bus_name: 'Tambaram Sanatorium Express',
      capacity: 32,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_101',
      bus_number: 'Bus 101',
      route_number: 101,
      bus_name: 'Kundrathur Local Line',
      capacity: 28,
      layout: '2x2',
      is_active: true
    },
    {
      id: 'bus_110',
      bus_number: 'Bus 110',
      route_number: 110,
      bus_name: 'Kundrathur 4 Road Feeder',
      capacity: 24,
      layout: '2x2',
      is_active: true
    }
  ];

  // Scheduled Trips for Today — All 16 CIT campus buses open for booking
  const trips: Trip[] = [
    {
      id: 'trip_bus_1',
      bus_id: 'bus_1',
      route_id: 'route_1',
      assigned_driver_id: 'usr_driver_1',
      travel_date: todayStr,
      departure_time: '03:30 PM',
      departure_time_iso: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 1 — Main Ground',
      notes: 'Batch 1 (03:30 PM) campus return departure passing Wimco Nagar Metro & Royapuram to Ennore.'
    },
    {
      id: 'trip_bus_2',
      bus_id: 'bus_2',
      route_id: 'route_2',
      assigned_driver_id: 'usr_driver_2',
      travel_date: todayStr,
      departure_time: '04:30 PM',
      departure_time_iso: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 2 — Main Terminus',
      notes: 'Batch 2 (04:30 PM) campus return departure to Tiruvottiyur via Tollgate.'
    },
    {
      id: 'trip_bus_3',
      bus_id: 'bus_3',
      route_id: 'route_3',
      assigned_driver_id: 'usr_driver_3',
      travel_date: todayStr,
      departure_time: '03:30 PM',
      departure_time_iso: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 3 — North Bay',
      notes: 'Batch 1 (03:30 PM) campus return departure to Tondiarpet & Mint Clock Tower.'
    },
    {
      id: 'trip_bus_4',
      bus_id: 'bus_4',
      route_id: 'route_4',
      assigned_driver_id: 'usr_driver_4',
      travel_date: todayStr,
      departure_time: '04:30 PM',
      departure_time_iso: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 4 — Terminal Bay',
      notes: 'Batch 2 (04:30 PM) campus return departure via Madhavaram to Manali.'
    },
    {
      id: 'trip_bus_5',
      bus_id: 'bus_5',
      route_id: 'route_5',
      assigned_driver_id: 'usr_driver_5',
      travel_date: todayStr,
      departure_time: '03:30 PM',
      departure_time_iso: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 5 — Central Ground',
      notes: 'Batch 1 (03:30 PM) campus return departure to KKD Nagar & Otteri.'
    },
    {
      id: 'trip_bus_14',
      bus_id: 'bus_14',
      route_id: 'route_14',
      assigned_driver_id: 'usr_driver_6',
      travel_date: todayStr,
      departure_time: '04:30 PM',
      departure_time_iso: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 6 — Anna Nagar Bay',
      notes: 'Batch 2 (04:30 PM) campus return departure via Villivakkam to Anna Nagar Roundtana.'
    },
    {
      id: 'trip_bus_18',
      bus_id: 'bus_18',
      route_id: 'route_18',
      assigned_driver_id: 'usr_driver_7',
      travel_date: todayStr,
      departure_time: '03:30 PM',
      departure_time_iso: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 7 — West Bay',
      notes: 'Batch 1 (03:30 PM) campus return departure to Tirumangalam EB & Anna Nagar West.'
    },
    {
      id: 'trip_bus_53',
      bus_id: 'bus_53',
      route_id: 'route_53',
      assigned_driver_id: 'usr_driver_8',
      travel_date: todayStr,
      departure_time: '04:30 PM',
      departure_time_iso: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 8 — ECR Bay',
      notes: 'Batch 2 (04:30 PM) campus return departure via Kottivakkam and Neelankarai to Thiruvanmiyur.'
    },
    {
      id: 'trip_bus_54',
      bus_id: 'bus_54',
      route_id: 'route_54',
      assigned_driver_id: 'usr_driver_9',
      travel_date: todayStr,
      departure_time: '03:30 PM',
      departure_time_iso: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 9 — OMR Bay',
      notes: 'Batch 1 (03:30 PM) campus return departure via Karapakkam and Sholinganallur to OMR.'
    },
    {
      id: 'trip_bus_68',
      bus_id: 'bus_68',
      route_id: 'route_68',
      assigned_driver_id: 'usr_driver_10',
      travel_date: todayStr,
      departure_time: '04:30 PM',
      departure_time_iso: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 10 — Velachery Bay',
      notes: 'Batch 2 (04:30 PM) campus return departure via Checkpost and Phoenix Mall to Velachery.'
    },
    {
      id: 'trip_bus_74',
      bus_id: 'bus_74',
      route_id: 'route_74',
      assigned_driver_id: 'usr_driver_11',
      travel_date: todayStr,
      departure_time: '03:30 PM',
      departure_time_iso: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 11 — Adyar Bay',
      notes: 'Batch 1 (03:30 PM) campus return departure via IIT Madras gate and Madhya Kailash to Adyar.'
    },
    {
      id: 'trip_bus_81',
      bus_id: 'bus_81',
      route_id: 'route_81',
      assigned_driver_id: 'usr_driver_12',
      travel_date: todayStr,
      departure_time: '04:30 PM',
      departure_time_iso: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 12 — South Gate Bay',
      notes: 'Batch 2 (04:30 PM) campus return departure to KK Nagar EB & Sivan Park.'
    },
    {
      id: 'trip_bus_86',
      bus_id: 'bus_86',
      route_id: 'route_86',
      assigned_driver_id: 'usr_driver_13',
      travel_date: todayStr,
      departure_time: '03:30 PM',
      departure_time_iso: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 13 — Porur Bay',
      notes: 'Batch 1 (03:30 PM) campus return departure via Madhananthapuram to Porur junction.'
    },
    {
      id: 'trip_bus_96',
      bus_id: 'bus_96',
      route_id: 'route_96',
      assigned_driver_id: 'usr_driver_14',
      travel_date: todayStr,
      departure_time: '04:30 PM',
      departure_time_iso: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 14 — GST Corridor Bay',
      notes: 'Batch 2 (04:30 PM) campus return departure to Tambaram Sanatorium & MEPZ.'
    },
    {
      id: 'trip_bus_101',
      bus_id: 'bus_101',
      route_id: 'route_101',
      assigned_driver_id: 'usr_driver_15',
      travel_date: todayStr,
      departure_time: '03:30 PM',
      departure_time_iso: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 15 — Local Bay',
      notes: 'Batch 1 (03:30 PM) campus return departure to Kundrathur Local stops.'
    },
    {
      id: 'trip_bus_110',
      bus_id: 'bus_110',
      route_id: 'route_110',
      assigned_driver_id: 'usr_driver_16',
      travel_date: todayStr,
      departure_time: '04:30 PM',
      departure_time_iso: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      booking_window_opens_at: oneHourAgo,
      booking_window_closes_at: threeHoursFromNow,
      status: 'OPEN',
      parking_bay: 'Bay 16 — Feeder Bay',
      notes: 'Batch 2 (04:30 PM) transit bus for Kundrathur 4 Road & Feeder stops.'
    }
  ];

  // All previous bookings cleared — fresh slate so all buses and seats are available for booking!
  const bookings: Booking[] = [];

  // Fresh boarding and communication logs
  const boarding_events: BoardingEvent[] = [];
  const email_logs: EmailLog[] = [];

  const settings: SystemSettings = {
    restrict_email_domain: false, // Flexible demo mode
    allowed_domain: '@citchennai.net',
    demo_mode: true
  };

  const bus_map: BusIdentificationMap = {
    id: 'cit_bus_map_today',
    image_url: '/assets/aistudio/WhatsApp_Image_2026-10-20_at_4.19.25_PM_4a42e03a.jpeg',
    title: 'CIT Campus Bus Identification & Parking Bay Allocation Map',
    effective_date: todayStr,
    updated_at: now.toISOString(),
    updated_by_name: 'Campus Transport Authenticator',
    updated_by_email: 'transport@citchennai.net',
    notes: 'Official campus parking bay layout and bus identification numbers for today. Reminder: Route numbers are used as bus numbers. Check your allocated parking bay before boarding.',
    version: 1
  };

  return {
    users,
    student_qr_identities,
    buses,
    routes,
    trips,
    bookings,
    boarding_events,
    email_logs,
    settings,
    bus_map
  };
}

class DatabaseManager {
  private inMemoryDb: DatabaseSchema;

  constructor() {
    this.inMemoryDb = this.load();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.trips)) {
          // Ensure bus_map exists
          if (!parsed.bus_map) {
            const seed = getInitialSeed();
            parsed.bus_map = seed.bus_map;
          }
          return parsed;
        }
      } catch (err) {
        console.error('Failed to parse database file, falling back to seed:', err);
      }
    }
    const seed = getInitialSeed();
    this.saveDirect(seed);
    return seed;
  }

  private saveDirect(data: DatabaseSchema): void {
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  // Atomically read state
  public read(): DatabaseSchema {
    return this.inMemoryDb;
  }

  // Atomically mutate state inside a locked transaction
  public transaction<T>(mutator: (db: DatabaseSchema) => T): T {
    const result = mutator(this.inMemoryDb);
    this.saveDirect(this.inMemoryDb);
    return result;
  }

  // Re-seed DB to initial fresh state
  public resetToSeed(): DatabaseSchema {
    this.inMemoryDb = getInitialSeed();
    this.saveDirect(this.inMemoryDb);
    return this.inMemoryDb;
  }
}

export const db = new DatabaseManager();
