import { fs } from "std/fs";
import { path } from "std/path";

print("--- Caminhos ---");
let p = path.join(["/tmp", "flexlang_test_dir", "sub", "file.txt"]);
print("Join: ${p}");

let ext = path.ext(p);
print("Ext: ${ext}");

let is_abs = path.is_absolute(p);
print("Is Abs: ${is_abs}");

print("--- File System ---");
let dir_path = path.dirname(p);
match fs.create_dir_all(dir_path) {
    Result.Ok(ok) {
        print("Create Dir All: OK");
    },
    Result.Err(err) {
        print("Create Dir All Err: ${err}");
    }
}

match fs.write_string(p, "Linha 1\n") {
    Result.Ok(ok) {
        print("Write String: OK");
    },
    Result.Err(err) {
        print("Write String Err: ${err}");
    }
}

match fs.append_string(p, "Linha 2\n") {
    Result.Ok(ok) {
        print("Append String: OK");
    },
    Result.Err(err) {
        print("Append String Err: ${err}");
    }
}

let exists = fs.exists(p);
print("Exists: ${exists}");

let is_file = fs.is_file(p);
print("Is File: ${is_file}");

let is_dir = fs.is_dir(p);
print("Is Dir: ${is_dir}");

match fs.read_to_string(p) {
    Result.Ok(content) {
        print("Read to String: ${content}");
    },
    Result.Err(err) {
        print("Read to String Err: ${err}");
    }
}

let target_dir = path.dirname(dir_path);
match fs.read_dir(target_dir) {
    Result.Ok(files) {
        print("Read Dir target:");
        // A ordem de fs_read_dir pode variar no disco ou entre SOs (ou ser apenas "sub"), vamos printar se nao é vazio
        // Não temos .length no typechecker Array. Vamos apenas dizer Ok
        print("Read Dir OK");
    },
    Result.Err(err) {
        print("Read Dir Err: ${err}");
    }
}

match fs.remove_file(p) {
    Result.Ok(ok) {
        print("Remove File: OK");
    },
    Result.Err(err) {
        print("Remove File Err: ${err}");
    }
}

let exists2 = fs.exists(p);
print("Exists After Remove: ${exists2}");

print("FS Done");
