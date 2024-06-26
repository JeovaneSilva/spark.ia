import { configDotenv } from "dotenv";
import { pbkdf2 } from "crypto";
import pkg from "pg";
const { Client } = pkg;

configDotenv();

const SALT = process.env.SALT;

// Setup BD
// *Adicionar TLS na produção
const client = new Client({
  user: "postgres",
  host: "127.0.0.1", // Trocar em produção para a url do servidor
  database: "spark.ia",
  password: process.env.DB_PASSWORD,
  port: 5432,
});
client.connect(function (err) {
  if (err) console.log("Erro ao iniciar a BD: " + err.message);
  else console.log("BD conectada!");
});

function hashSenha(senha) {
  return new Promise((resolve, reject) => {
    pbkdf2(senha, SALT, 310000, 32, "sha256", (err, hashSenha) => {
      if (err) return reject(err);
      resolve(hashSenha.toString("hex"));
    });
  });
}

export async function getUsuário(email) {
  const query = {
    text: `SELECT * FROM usuario WHERE email = $1`,
    values: [email],
  };
  try {
    const result = await client.query(query);
    return result.rows[0];
  } catch (err) {
    console.error(err);
    return null;
  }
}

function validarEmail(email) {
  const re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

function validarUsuário(nome) {
  const regex = /^[a-zA-Z0-9_\s]+$/;
  return regex.test(nome);
}

function validarSenha(senha) {
  const regex = /\s/;
  if (regex.test(senha)) return Error("Sua senha não pode conter espaços!");
  if (senha.length < 8)
    return Error("Sua senha deve ter no mínimo 8 caracteres!");
}

export async function novoUsuário(nome, email, senha, confirmarSenha) {
  // Validar input
  if (senha !== confirmarSenha) {
    return Error("Suas senhas não estão iguais!");
  }
  if (!validarUsuário(nome)) {
    return Error("Nome de usuário inválido!");
  }
  if (!validarEmail(email)) {
    return Error("Email inválido!");
  }
  const valSenha = validarSenha(senha);
  if (valSenha instanceof Error) return valSenha;

  // Checar se já existe um usuário com o mesmo email
  if ((await getUsuário(email)) == null) {
    //Gerar um hash com da senha escolhida
    const resultado = await hashSenha(senha);
    if (resultado instanceof Error) {
      return Error("Erro no hash da senha!");
    }
    //Adicionar o usuário na base de dados
    client.query(
      `INSERT INTO usuario (nome, email, senha) VALUES ($1, $2, $3)`,
      [nome, email, resultado]
    );
    return { message: "Usuário criado com sucesso!" };
  } else {
    return Error("Já existe um usuário com esse email!");
  }
}

export async function autenticarUsuário(email, senha) {
  const usuárioData = await getUsuário(email);
  const usuárioExiste = usuárioData != null;
  const msg = "Usuário e/ou senha inválidos!";
  if (usuárioExiste) {
    //Checar hash da senha
    const hash = await hashSenha(senha);
    const hashCadastrado = usuárioData.senha;
    if (hash === hashCadastrado) {
      return usuárioData;
    } else {
      return Error(msg);
    }
  } else {
    return Error(msg);
  }
}
