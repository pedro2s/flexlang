package main

import "fmt"
import "sync"
import "net/http"
import "encoding/json"

// --- FlexLang HTTP Boilerplate ---
type Request struct { Raw *http.Request }
type Response struct { Raw http.ResponseWriter }
func (r Response) json(data any) {
    r.Raw.Header().Set("Content-Type", "application/json")
    json.NewEncoder(r.Raw).Encode(data)
}
type Server struct { Addr string; Mux *http.ServeMux }
func NewServer(addr string) *Server { return &Server{Addr: addr, Mux: http.NewServeMux()} }
func (s *Server) route(path string, handler func(req Request, res Response)) {
    s.Mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) { handler(Request{Raw: r}, Response{Raw: w}) })
}
func (s *Server) start() { http.ListenAndServe(s.Addr, s.Mux) }
// ---------------------------------

func handle_users(req Request, res Response)  {
  resposta := "Alo, Mundo! Esta eh a FlexLang rodando na web!"
  res.json(resposta)
}

func main() {
  server := NewServer(":8080")
  server.route("/users", handle_users)
  fmt.Println("Subindo o servidor em http://localhost:8080/users ...")
  server.start()
}
