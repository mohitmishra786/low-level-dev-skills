# West Manifest Reference

Source: https://docs.zephyrproject.org/latest/develop/west/manifest.html

## Table of Contents

1. [west.yml Structure](#westyml-structure)
2. [Common Commands](#common-commands)
3. [Custom Module](#custom-module)

## west.yml Structure

```yaml
# west.yml — placed at workspace root (T2 topology)
manifest:
  version: "0.13"

  remotes:
    - name: zephyrproject-rtos
      url-base: https://github.com/zephyrproject-rtos

  defaults:
    remote: zephyrproject-rtos

  projects:
    - name: zephyr
      revision: v3.7.0          # pin to a release tag
      import: true              # import Zephyr's own west.yml

    # Add a custom driver module
    - name: my-drivers
      url: https://github.com/myorg/my-drivers
      revision: main
      path: modules/my-drivers

  self:
    path: app                   # this repo's path in the workspace
```

## Common Commands

```bash
# Initialize workspace from manifest
west init -m https://github.com/myorg/my-manifest workspace/
cd workspace && west update

# Update all projects to manifest revisions
west update

# Show workspace state
west list
west status

# Run a command across all projects
west forall -c "git log --oneline -5"

# Fetch without updating
west update --narrow

# Create a snapshot manifest (freeze all revisions)
west manifest --resolve > west-snapshot.yml
```

## Custom Module

To add a custom HAL or driver as a Zephyr module:

```yaml
# modules/my-hal/zephyr/module.yml
build:
  cmake: CMakeLists.txt
  kconfig: Kconfig

  settings:
    dts_root: .         # if module has devicetree bindings
    board_root: .       # if module defines custom boards
```

```cmake
# modules/my-hal/CMakeLists.txt
zephyr_include_directories(include)
zephyr_library_sources(src/my_hal.c)
```

```
# modules/my-hal/Kconfig
config MY_HAL
    bool "My HAL driver"
    depends on I2C
    help
      Enable My HAL I2C driver.
```
