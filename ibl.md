# Favela/Honda R&D doc

## Skeletal animation

## IBL

-   add IBLSystem
    -   Answers the question of: which cubemap to use when rendering
    -   Also holds the sky texture for convenience (sky is default cubemap)
    -   IBL component:
        -   type 1: skyinfo (aka default reflection source)
        -   type 2: probe (location + area)
-   Support IBL capture in engine (loading step)
    -   hijack gameloop/rendering step
        -   take control of camera (position, rotation, fov, aspect ratio)
        -   run IBL,light,mesh systems
        -   run all non postprocess passes for each side of each probe
        -   store all + compte MIPs
        -   cleanup

## Blur
