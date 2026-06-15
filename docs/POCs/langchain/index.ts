import dotenv from 'dotenv';
import { APIService } from './src/APIService';

dotenv.config();

const apiService = new APIService();
apiService.init();
