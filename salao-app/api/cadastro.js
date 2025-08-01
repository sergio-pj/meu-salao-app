// Importa o MongoClient para podermos nos conectar ao banco
import { MongoClient } from 'mongodb';
// Importa a biblioteca para criptografia de senhas
import bcrypt from 'bcryptjs';

// Pega a sua String de Conexão da variável de ambiente
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectToDatabase() {
    await client.connect();
    return client.db('salao_beleza_db'); // Você pode nomear seu banco de dados aqui
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { nomeSalao, email, senha } = req.body;

        if (!nomeSalao || !email || !senha) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
        }

        // Conecta ao banco de dados
        const db = await connectToDatabase();
        const saloesCollection = db.collection('saloes');

        // Verifica se o e-mail já está em uso
        const salaoExistente = await saloesCollection.findOne({ email: email });
        if (salaoExistente) {
            return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
        }

        // ---- CRIPTOGRAFIA DA SENHA ----
        // Gera um "salt" - um fator aleatório para fortalecer a criptografia
        const salt = await bcrypt.genSalt(10);
        // Criptografa a senha do usuário junto com o salt
        const senhaHash = await bcrypt.hash(senha, salt);
        // --------------------------------

        // Insere o novo salão no banco de dados com a senha criptografada
        const result = await saloesCollection.insertOne({
            nomeSalao,
            email,
            senha: senhaHash, // Salvamos a senha criptografada!
            criadoEm: new Date(),
        });

        res.status(201).json({ message: 'Salão cadastrado com sucesso!', id: result.insertedId });

    } catch (error) {
        console.error('Erro no cadastro:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar cadastrar.' });
    }
}
