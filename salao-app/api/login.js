import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'; // Importa a biblioteca JWT

const uri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET; // Pega a chave secreta do ambiente
const client = new MongoClient(uri);

async function connectToDatabase() {
    await client.connect();
    return client.db('salao_beleza_db');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }

        const db = await connectToDatabase();
        const saloesCollection = db.collection('saloes');

        const salaoExistente = await saloesCollection.findOne({ email: email });
        if (!salaoExistente) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const senhaCorreta = await bcrypt.compare(senha, salaoExistente.senha);
        if (!senhaCorreta) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // ---- CRIAÇÃO DO TOKEN JWT ----
        // Define o que vamos armazenar dentro do token (o "payload")
        const payload = {
            id: salaoExistente._id, // ID do salão no banco
            email: salaoExistente.email,
            nome: salaoExistente.nomeSalao
        };

        // Assina o token com o payload e a chave secreta
        // Ele expira em 1 dia ('1d')
        const token = jwt.sign(payload, jwtSecret, { expiresIn: '1d' });
        // -----------------------------

        // Envia o token de volta para o cliente
        res.status(200).json({ message: 'Login realizado com sucesso!', token: token });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}
