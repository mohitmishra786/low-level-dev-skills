---
name: compiler-frontend
description: Compiler frontend skill for lexing, parsing, and type checking. Use when building a lexer/parser, designing AST nodes, implementing symbol tables, type checking, error recovery, or emitting LLVM IR. Activates on queries about lexer, Pratt parser, recursive descent, AST, symbol table, Hindley-Milner, or llvm-sys.
---

# Compiler Frontend

## Purpose

Guide agents through building a compiler frontend: lexers (hand-written DFA vs flex), Pratt parsing for expressions, recursive-descent for statements, AST design, symbol tables with scoped hash maps, type checking basics, error recovery strategies, and LLVM IR generation via the C API or `llvm-sys`.

## When to Use

- Implementing a new programming language or DSL
- Adding expression parsing to an interpreter or config language
- Designing AST node hierarchies in C or Rust
- Building scoped symbol tables for variables and functions
- Implementing basic type inference or checking
- Emitting LLVM IR from a typed AST

## Workflow

### 1. Pipeline overview

```
Source → Lexer (tokens) → Parser (AST) → Type checker → IR generator → LLVM IR
```

### 2. Lexer — hand-written DFA

```c
typedef enum {
    TOK_EOF, TOK_INT, TOK_IDENT, TOK_PLUS, TOK_MINUS,
    TOK_LPAREN, TOK_RPAREN, TOK_SEMI, TOK_EQ,
} TokenKind;

typedef struct {
    TokenKind kind;
    const char *start;
    int length;
    int64_t int_val;
} Token;

typedef struct {
    const char *src;
    int pos;
    int line;
} Lexer;

static void skip_whitespace(Lexer *l) {
    while (l->src[l->pos] == ' ' || l->src[l->pos] == '\n') l->pos++;
}

Token lexer_next(Lexer *l) {
    skip_whitespace(l);
    const char *start = &l->src[l->pos];

    if (isdigit(l->src[l->pos])) {
        int64_t val = 0;
        while (isdigit(l->src[l->pos]))
            val = val * 10 + (l->src[l->pos++] - '0');
        return (Token){ TOK_INT, start, l->pos - (start - l->src), val };
    }
    if (isalpha(l->src[l->pos])) {
        while (isalnum(l->src[l->pos])) l->pos++;
        return (Token){ TOK_IDENT, start, l->pos - (start - l->src), 0 };
    }
    char c = l->src[l->pos++];
    switch (c) {
        case '+': return (Token){ TOK_PLUS, start, 1, 0 };
        case '(': return (Token){ TOK_LPAREN, start, 1, 0 };
        case ')': return (Token){ TOK_RPAREN, start, 1, 0 };
        case ';': return (Token){ TOK_SEMI, start, 1, 0 };
        default:  return (Token){ TOK_EOF, start, 0, 0 };
    }
}
```

```bash
# flex alternative
flex lexer.l && gcc -o lexer lexer.tab.c -lfl
```

### 3. Pratt parser for expressions

```c
typedef enum { AST_INT, AST_BINOP, AST_VAR } AstKind;

typedef struct AstNode {
    AstKind kind;
    union {
        int64_t int_val;
        struct { int op; struct AstNode *lhs, *rhs; } binop;
        char *name;
    };
} AstNode;

// Binding powers: higher = tighter precedence
enum { BP_NONE = 0, BP_SUM = 10, BP_PRODUCT = 20 };

AstNode *parse_expression(Parser *p, int min_bp) {
    AstNode *left = parse_prefix(p);
    for (;;) {
        int lbp, rbp;
        if (!infix_binding_power(p->cur.kind, &lbp, &rbp) || lbp < min_bp)
            break;
        advance(p);
        AstNode *right = parse_expression(p, rbp);
        left = make_binop(p->cur.kind, left, right);
    }
    return left;
}
```

Pratt handles operator precedence cleanly without massive grammar tables.

### 4. Recursive descent for statements

```c
AstNode *parse_statement(Parser *p) {
    if (match(p, TOK_IDENT) && peek(p) == TOK_EQ) {
        char *name = p->prev.text;
        advance(p);  // =
        AstNode *expr = parse_expression(p, BP_NONE);
        expect(p, TOK_SEMI);
        return make_assign(name, expr);
    }
    if (match(p, TOK_RETURN)) {
        AstNode *expr = parse_expression(p, BP_NONE);
        expect(p, TOK_SEMI);
        return make_return(expr);
    }
    return parse_expression_statement(p);
}
```

### 5. AST and symbol table

```c
typedef struct Symbol {
    char *name;
    Type *type;
    LLVMValueRef llvm_val;  // after codegen
    struct Symbol *next;
} Symbol;

typedef struct Scope {
    Symbol *symbols;       // hash map bucket chain
    struct Scope *parent;
} Scope;

Symbol *scope_lookup(Scope *s, const char *name) {
    for (Scope *cur = s; cur; cur = cur->parent) {
        for (Symbol *sym = cur->symbols; sym; sym = sym->next)
            if (strcmp(sym->name, name) == 0)
                return sym;
    }
    return NULL;
}

void scope_define(Scope *s, const char *name, Type *type) {
    Symbol *sym = malloc(sizeof(Symbol));
    sym->name = strdup(name);
    sym->type = type;
    sym->next = s->symbols;
    s->symbols = sym;
}
```

### 6. Type checker (basics)

```c
typedef enum { TY_INT, TY_BOOL, TY_FUNC, TY_VOID } TypeKind;

Type *check_expr(Scope *s, AstNode *node) {
    switch (node->kind) {
    case AST_INT: return type_int();
    case AST_VAR: {
        Symbol *sym = scope_lookup(s, node->name);
        if (!sym) error("undefined variable %s", node->name);
        return sym->type;
    }
    case AST_BINOP: {
        Type *lt = check_expr(s, node->binop.lhs);
        Type *rt = check_expr(s, node->binop.rhs);
        if (!type_equal(lt, rt))
            error("type mismatch in binary op");
        return lt;
    }
    }
    return type_void();
}
```

Hindley-Milner (full inference): assign type variables, unify on constraints — use for ML-like languages.

### 7. Error recovery

| Strategy | When |
|----------|------|
| Panic mode | Skip tokens until synchronizing token (`;`, `}`) |
| Synchronization sets | Define recovery tokens per nonterminal |
| Error productions | Grammar rules for common mistakes |
| Single-token insertion/deletion | IDE-friendly recovery |

```c
void synchronize(Parser *p) {
    advance(p);
    while (p->cur.kind != TOK_EOF) {
        if (p->prev.kind == TOK_SEMI) return;
        if (p->cur.kind == TOK_RETURN || p->cur.kind == TOK_IDENT) return;
        advance(p);
    }
}
```

### 8. LLVM IR generation

```c
#include <llvm-c/Core.h>
#include <llvm-c/ExecutionEngine.h>

LLVMModuleRef module;
LLVMBuilderRef builder;

LLVMValueRef codegen_expr(Scope *s, AstNode *node) {
    switch (node->kind) {
    case AST_INT:
        return LLVMConstInt(LLVMInt32Type(), node->int_val, 1);
    case AST_BINOP: {
        LLVMValueRef l = codegen_expr(s, node->binop.lhs);
        LLVMValueRef r = codegen_expr(s, node->binop.rhs);
        if (node->binop.op == TOK_PLUS)
            return LLVMBuildAdd(builder, l, r, "add");
        break;
    }
    case AST_VAR: {
        Symbol *sym = scope_lookup(s, node->name);
        return LLVMBuildLoad(builder, sym->llvm_val, node->name);
    }
    }
    return NULL;
}
```

```bash
# Dump IR
LLVMDumpModule(module);
# Verify
char *err = NULL;
LLVMVerifyModule(module, LLVMReturnStatusAction, &err);
```

Rust: use `inkwell` or `llvm-sys` crates for safer bindings.

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Parser infinite loop | Missing advance on error | Audit all branches advance token |
| Wrong operator precedence | Incorrect binding powers | Table-test expressions |
| Duplicate symbol in scope | No shadowing check | Lookup parent only for read; define in current |
| LLVM verify fails | Type mismatch in IR | Check signedness, pointer levels |
| flex token clash | Overlapping patterns | Longest match; order rules |
| Error cascade | No synchronization | Implement panic mode recovery |

## Related Skills

- `skills/compiler-internals/llvm-passes` — optimize generated IR
- `skills/compiler-internals/jit-compilation` — execute generated IR
- `skills/compiler-internals/mlir` — higher-level IR for DSLs
- `skills/compilers/llvm` — LLVM as a user (opt, llc)
- `skills/low-level-programming/interpreters` — bytecode VM alternative
- `skills/languages/carbon-lang` — modern language frontend example