# GDB Python Scripting and Pretty-Printers

Source: <https://sourceware.org/gdb/current/onlinedocs/gdb.html/Python.html>

## GDB Python API basics

GDB embeds a Python interpreter. Scripts can be loaded with `source script.py` or placed in `~/.gdb_scripts/`.

```python
import gdb

# Execute GDB command
gdb.execute('bt full')

# Evaluate expression
val = gdb.parse_and_eval('x')
print(val)

# Read inferior memory
inf = gdb.selected_inferior()
mem = inf.read_memory(0x601060, 16)

# List threads
for thr in gdb.selected_inferior().threads():
    print(thr.num, thr.name)
```

## Custom pretty-printer

```python
import gdb
import gdb.printing

class MyVectorPrinter:
    def __init__(self, val):
        self.val = val

    def to_string(self):
        data = self.val['_data']
        size = int(self.val['_size'])
        return f'MyVector of {size} elements'

    def children(self):
        data = self.val['_data']
        size = int(self.val['_size'])
        for i in range(size):
            yield f'[{i}]', (data + i).dereference()

    def display_hint(self):
        return 'array'

def build_printer(val):
    t = val.type.strip_typedefs()
    if t.name == 'MyVector':
        return MyVectorPrinter(val)
    return None

gdb.pretty_printers.append(build_printer)
```

Load in GDB:

```gdb
source /path/to/printer.py
```

## STL pretty-printers (libstdc++)

```bash
# Install python3-gdb package (Debian/Ubuntu)
sudo apt install python3-gdb

# Or use the GCC source tree printers
# They load automatically if libstdc++ was built with GDB support
```

## Breakpoint commands

```gdb
break foo
commands
  silent
  print "hit foo, x =", x
  continue
end
```

## Convenience variables

```gdb
set $i = 0
while $i < 10
  print arr[$i]
  set $i = $i + 1
end
```

## Useful define aliases

```gdb
define pbt
  thread apply all bt full
end

define hex
  print/x $arg0
end
```

Place in `~/.gdbinit`.
