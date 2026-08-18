// Repositório e Banco em Memória do FlexBank (RFC-023, RFC-025, RFC-028)

import { Account } from "../models/account";
import { Transaction } from "../models/transaction";
import { User, SessionToken } from "../models/auth";
import { hash, uuid } from "crypto";

let mut users_map = HashMap.new();
let mut accounts_map = HashMap.new();
let mut sessions_map = HashMap.new();
let mut transactions_list: Array<Transaction> = [];

func init_database() {
    let u1_pass = hash.bcrypt("senha123");
    let mut u1_hash = "";
    match u1_pass {
        Result.Ok(h) { u1_hash = h; },
        Result.Err(e) { u1_hash = ""; }
    }

    let u1 = User {
        id: "usr_alice",
        name: "Alice Santana",
        email: "alice@flexbank.com",
        password_hash: u1_hash
    };
    users_map.set(u1.email, u1);

    let acc1 = Account {
        id: "acc_alice",
        holder: "Alice Santana",
        cpf: "123.456.789-00",
        email: "alice@flexbank.com",
        balance: "1500.50",
        status: "ACTIVE"
    };
    accounts_map.set(acc1.id, acc1);

    let acc2 = Account {
        id: "acc_bob",
        holder: "Bob Silva",
        cpf: "987.654.321-99",
        email: "bob@flexbank.com",
        balance: "300.00",
        status: "ACTIVE"
    };
    accounts_map.set(acc2.id, acc2);
}

func find_user_by_email(email: String) -> Option<User> {
    return users_map.get(email);
}

func save_user(u: User) {
    users_map.set(u.email, u);
}

func find_account(id: String) -> Option<Account> {
    return accounts_map.get(id);
}

func save_account(acc: Account) {
    accounts_map.set(acc.id, acc);
}

func save_session(s: SessionToken) {
    sessions_map.set(s.token, s);
}

func find_session(token: String) -> Option<SessionToken> {
    return sessions_map.get(token);
}

func add_transaction(t: Transaction) {
    transactions_list.push(t);
}

func get_account_transactions(account_id: String) -> Array<Transaction> {
    return transactions_list.filter(|t: Transaction| {
        return t.account_id == account_id;
    });
}
