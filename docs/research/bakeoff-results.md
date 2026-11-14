# Bake-off results: pipeline A vs pipeline B

Written by `pipeline/bakeoff/score.py` from the frozen rules in `pipeline/bakeoff/PROTOCOL.md`. Every number here is measured by the scorer [V]. Thresholds are our own choice [U].

## Summary

Pipeline A wins the method decision: A won 6 of 12 contests and B won 6 [V]. A 6 to 6 result goes to A by the protocol.
Fire days are the calendar default: the winner's hotspot error is within 1.25 times its fire-day error in only 6 of 12 contests (needs 8) [V].
The world gate is not met: 1 check(s) fail [V]. The team decides.

Truth check against the raw-file samples: matches exactly [V].

## The 12 contests (rule 1) [V]

Unit `cd` (fire cell-days). The lower nRMSE wins. A tie goes to A.

| level | test | country | nrmse_A | nrmse_B | winner |
|---|---|---|---|---|---|
| a | t1 | Bulgaria | 0.3233 | 0.3171 | B |
| a | t1 | United_States | 0.1203 | 0.1635 | A |
| a | t2 | Bulgaria | 0.2632 | 0.2330 | B |
| a | t2 | United_States | 0.1016 | 0.1514 | A |
| b | t1 | Bulgaria | 2.1342 | 2.3726 | A |
| b | t1 | United_States | 3.8178 | 4.0897 | A |
| b | t2 | Bulgaria | 1.6860 | 1.8112 | A |
| b | t2 | United_States | 3.3869 | 3.7451 | A |
| c | t1 | Bulgaria | 1.1190 | 0.8501 | B |
| c | t1 | United_States | 1.3618 | 0.8919 | B |
| c | t2 | Bulgaria | 0.8388 | 0.6537 | B |
| c | t2 | United_States | 0.9138 | 0.8352 | B |

## Default unit (rule 2, D-7) [V]

Winner A. Needs hotspot nRMSE at most 1.25 times fire-day nRMSE [U] in at least 8 of 12 contests. Result: 6 of 12.

| level | test | country | nrmse_cd | nrmse_hot | within |
|---|---|---|---|---|---|
| a | t1 | Bulgaria | 0.3233 | 0.3594 | yes |
| a | t1 | United_States | 0.1203 | 0.3045 | no |
| a | t2 | Bulgaria | 0.2632 | 0.2603 | yes |
| a | t2 | United_States | 0.1016 | 0.1655 | no |
| b | t1 | Bulgaria | 2.1342 | 2.5064 | yes |
| b | t1 | United_States | 3.8178 | 7.7951 | no |
| b | t2 | Bulgaria | 1.6860 | 1.9286 | yes |
| b | t2 | United_States | 3.3869 | 5.0663 | no |
| c | t1 | Bulgaria | 1.1190 | 1.3481 | yes |
| c | t1 | United_States | 1.3618 | 2.5193 | no |
| c | t2 | Bulgaria | 0.8388 | 0.9615 | yes |
| c | t2 | United_States | 0.9138 | 1.4902 | no |

## Gate to the whole world (rule 3) [V]

| check | value | rule | result |
|---|---|---|---|
| Bulgaria t1 level a nRMSE | 0.3233 | at most 0.30 | fail |
| Bulgaria t1 level a bias | 0.0923 | within +-0.10 | pass |
| Bulgaria t1 level b coverage | 0.9494 | 0.80 to 0.97 (band 0.9) | pass |
| Bulgaria t2 level a nRMSE | 0.2632 | at most 0.30 | pass |
| Bulgaria t2 level a bias | -0.0501 | within +-0.10 | pass |
| Bulgaria t2 level b coverage | 0.9425 | 0.80 to 0.97 (band 0.9) | pass |
| United_States t1 level a nRMSE | 0.1203 | at most 0.30 | pass |
| United_States t1 level a bias | -0.0613 | within +-0.10 | pass |
| United_States t1 level b coverage | 0.9505 | 0.80 to 0.97 (band 0.9) | pass |
| United_States t2 level a nRMSE | 0.1016 | at most 0.30 | pass |
| United_States t2 level a bias | 0.0734 | within +-0.10 | pass |
| United_States t2 level b coverage | 0.9513 | 0.80 to 0.97 (band 0.9) | pass |
| truth samples match the raw files | 1.0000 | must match exactly | pass |
| control totals (V-M125) | n/a | not recomputed here; reported by the pipeline team | not computed |

A miss is reported here. The team decides.

## Manifests

- A: band 0.9.
- B: band 0.8.

## Full tables [V]

Columns: n = rows scored, nRMSE = root mean squared error over mean truth, MAE = mean absolute error, bias = (sum predicted - sum truth) / sum truth, r = Pearson r, slope = slope of truth on prediction, coverage = share of rows with lo <= truth <= hi, MAPE = on rows with truth above 0 (information only).

### Pipeline A, level (a) country x month

| test | country | unit | grid | n | nrmse | mae | bias | r | slope | coverage | mape | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t1 | Bulgaria | cd | q25 | 48 | 0.3233 | 67.4556 | 0.0923 | 0.9818 | 1.0436 | 1.0000 | 0.8198 | 0.9000 |
| t1 | Bulgaria | hot | q25 | 48 | 0.3594 | 97.6481 | 0.0472 | 0.9841 | 1.1209 | 1.0000 | 0.8700 | 0.9000 |
| t1 | United_States | cd | q25 | 48 | 0.1203 | 1702.5810 | -0.0613 | 0.9858 | 1.0306 | 1.0000 | 0.0964 | 0.9000 |
| t1 | United_States | hot | q25 | 48 | 0.3045 | 5833.3566 | -0.1178 | 0.9780 | 1.2335 | 1.0000 | 0.1225 | 0.9000 |
| t2 | Bulgaria | cd | q25 | 47 | 0.2632 | 73.1380 | -0.0501 | 0.9895 | 1.1346 | 1.0000 | 0.6410 | 0.9000 |
| t2 | Bulgaria | hot | q25 | 47 | 0.2603 | 100.6968 | -0.0324 | 0.9890 | 1.1129 | 1.0000 | 0.6887 | 0.9000 |
| t2 | United_States | cd | q25 | 47 | 0.1016 | 1364.3425 | 0.0734 | 0.9921 | 1.0170 | 1.0000 | 0.1024 | 0.9000 |
| t2 | United_States | hot | q25 | 47 | 0.1655 | 4194.5367 | 0.1163 | 0.9906 | 0.9872 | 1.0000 | 0.1672 | 0.9000 |
| t3 | Bulgaria | cd | q25 | 36 | 0.7617 | 90.3314 | 0.5410 | 0.8957 | 0.7531 | 1.0000 | 2.0989 | 0.9000 |
| t3 | Bulgaria | hot | q25 | 36 | 0.6546 | 111.0041 | 0.4338 | 0.9146 | 0.8579 | 1.0000 | 2.3459 | 0.9000 |
| t3 | United_States | cd | q25 | 36 | 0.1292 | 1613.1285 | -0.0797 | 0.9590 | 1.0824 | 1.0000 | 0.0956 | 0.9000 |
| t3 | United_States | hot | q25 | 36 | 0.1466 | 2529.6256 | -0.0597 | 0.9609 | 1.0506 | 1.0000 | 0.0780 | 0.9000 |

### Pipeline A, level (b) q25 cell x month

| test | country | unit | grid | n | nrmse | mae | bias | r | slope | coverage | mape | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t1 | Bulgaria | cd | q25 | 11616 | 2.1342 | 0.9932 | 0.0923 | 0.8948 | 1.0737 | 0.9494 | 0.7097 | 0.9000 |
| t1 | Bulgaria | hot | q25 | 11616 | 2.5064 | 1.3522 | 0.0472 | 0.8921 | 1.1799 | 0.9434 | 0.7736 | 0.9000 |
| t1 | United_States | cd | q25 | 689952 | 3.8178 | 0.9823 | -0.0613 | 0.9473 | 1.0301 | 0.9505 | 0.6788 | 0.9000 |
| t1 | United_States | hot | q25 | 689952 | 7.7951 | 1.7871 | -0.1178 | 0.9482 | 1.2807 | 0.9470 | 0.8135 | 0.9000 |
| t2 | Bulgaria | cd | q25 | 11374 | 1.6860 | 1.2098 | -0.0501 | 0.9049 | 1.0311 | 0.9425 | 0.7003 | 0.9000 |
| t2 | Bulgaria | hot | q25 | 11374 | 1.9286 | 1.6771 | -0.0324 | 0.8992 | 1.0594 | 0.9385 | 0.7503 | 0.9000 |
| t2 | United_States | cd | q25 | 675578 | 3.3869 | 0.9307 | 0.0734 | 0.9412 | 0.9871 | 0.9513 | 0.7032 | 0.9000 |
| t2 | United_States | hot | q25 | 675578 | 5.0663 | 1.5974 | 0.1163 | 0.9564 | 1.0604 | 0.9482 | 0.9230 | 0.9000 |
| t3 | Bulgaria | cd | q25 | 8712 | 2.9705 | 0.8265 | 0.5449 | 0.7567 | 0.6501 | 0.9505 | 0.7647 | 0.9000 |
| t3 | Bulgaria | hot | q25 | 8712 | 3.1421 | 1.1172 | 0.4390 | 0.8188 | 0.9188 | 0.9663 | 0.8476 | 0.9000 |
| t3 | United_States | cd | q25 | 517464 | 3.1391 | 0.9516 | -0.0681 | 0.8905 | 0.9681 | 0.9375 | 0.6859 | 0.9000 |
| t3 | United_States | hot | q25 | 517464 | 5.2011 | 1.5481 | -0.0427 | 0.9077 | 1.0978 | 0.9387 | 0.8098 | 0.9000 |

### Pipeline A, level (c) 50 km circle x month

| test | country | unit | grid | n | nrmse | mae | bias | r | slope | coverage | mape | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t1 | Bulgaria | cd | q25 | 288 | 1.1190 | 7.8689 | -0.0264 | 0.9332 | 1.3493 | 0.9826 | 1.3101 | 0.9000 |
| t1 | Bulgaria | hot | q25 | 288 | 1.3481 | 11.1840 | -0.0773 | 0.9462 | 1.5341 | 0.9826 | 1.4863 | 0.9000 |
| t1 | United_States | cd | q25 | 672 | 1.3618 | 11.8485 | -0.0974 | 0.9042 | 0.9737 | 0.9449 | 0.8119 | 0.9000 |
| t1 | United_States | hot | q25 | 672 | 2.5193 | 29.9891 | -0.1580 | 0.8225 | 1.1586 | 0.9360 | 1.0289 | 0.9000 |
| t2 | Bulgaria | cd | q25 | 282 | 0.8388 | 9.6609 | -0.1161 | 0.9688 | 1.3026 | 0.9929 | 0.9408 | 0.9000 |
| t2 | Bulgaria | hot | q25 | 282 | 0.9615 | 13.5945 | -0.1049 | 0.9691 | 1.3437 | 0.9929 | 1.0688 | 0.9000 |
| t2 | United_States | cd | q25 | 658 | 0.9138 | 9.5353 | 0.0229 | 0.9490 | 0.9787 | 0.9681 | 0.9893 | 0.9000 |
| t2 | United_States | hot | q25 | 658 | 1.4902 | 20.5680 | 0.0931 | 0.9135 | 0.9088 | 0.9544 | 1.4990 | 0.9000 |
| t3 | Bulgaria | cd | q25 | 216 | 1.1063 | 6.2880 | 0.4114 | 0.7278 | 0.8223 | 0.9815 | 1.5769 | 0.9000 |
| t3 | Bulgaria | hot | q25 | 216 | 1.1176 | 8.3360 | 0.4116 | 0.7549 | 0.8307 | 0.9815 | 1.7718 | 0.9000 |
| t3 | United_States | cd | q25 | 504 | 1.2848 | 12.3793 | -0.0867 | 0.9070 | 0.8476 | 0.9643 | 0.7737 | 0.9000 |
| t3 | United_States | hot | q25 | 504 | 1.5561 | 27.5364 | -0.1282 | 0.8788 | 0.8821 | 0.9425 | 1.0801 | 0.9000 |

### Pipeline B, level (a) country x month

| test | country | unit | grid | n | nrmse | mae | bias | r | slope | coverage | mape | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t1 | Bulgaria | cd | q25 | 48 | 0.3171 | 49.9631 | 0.0076 | 0.9803 | 0.9763 | 0.7708 | 0.2768 | 0.8000 |
| t1 | Bulgaria | hot | q25 | 48 | 0.4066 | 75.7605 | -0.0125 | 0.9733 | 1.0617 | 0.8750 | 0.2712 | 0.8000 |
| t1 | United_States | cd | q25 | 48 | 0.1635 | 2270.5440 | -0.0656 | 0.9700 | 0.9583 | 0.8333 | 0.1276 | 0.8000 |
| t1 | United_States | hot | q25 | 48 | 0.4064 | 9140.2393 | -0.1208 | 0.9582 | 1.3681 | 0.9167 | 0.1894 | 0.8000 |
| t2 | Bulgaria | cd | q25 | 47 | 0.2330 | 56.8753 | -0.0089 | 0.9859 | 0.9976 | 0.7660 | 0.2402 | 0.8000 |
| t2 | Bulgaria | hot | q25 | 47 | 0.3048 | 94.7822 | -0.0026 | 0.9777 | 1.0180 | 0.8298 | 0.2484 | 0.8000 |
| t2 | United_States | cd | q25 | 47 | 0.1514 | 1851.9632 | 0.0609 | 0.9698 | 0.9490 | 1.0000 | 0.1201 | 0.8000 |
| t2 | United_States | hot | q25 | 47 | 0.2930 | 6575.5079 | 0.1155 | 0.9549 | 1.1235 | 1.0000 | 0.2621 | 0.8000 |
| t3 | Bulgaria | cd | q25 | 36 | 0.3047 | 28.7377 | 0.1381 | 0.9756 | 0.8614 | 0.8889 | 0.4357 | 0.8000 |
| t3 | Bulgaria | hot | q25 | 36 | 0.2904 | 40.2830 | 0.0851 | 0.9696 | 1.0045 | 0.8889 | 0.5409 | 0.8000 |
| t3 | United_States | cd | q25 | 36 | 0.1421 | 1944.0960 | -0.0761 | 0.9535 | 0.8500 | 0.7778 | 0.1326 | 0.8000 |
| t3 | United_States | hot | q25 | 36 | 0.1959 | 4372.2775 | -0.0210 | 0.9130 | 0.9771 | 0.9722 | 0.1393 | 0.8000 |

### Pipeline B, level (b) q25 cell x month

| test | country | unit | grid | n | nrmse | mae | bias | r | slope | coverage | mape | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t1 | Bulgaria | cd | q25 | 11616 | 2.3726 | 0.8760 | 0.0076 | 0.8686 | 0.9180 | 0.8244 | 1.1047 | 0.8000 |
| t1 | Bulgaria | hot | q25 | 11616 | 2.7379 | 1.2229 | -0.0125 | 0.8571 | 1.0261 | 0.8248 | 1.2218 | 0.8000 |
| t1 | United_States | cd | q25 | 689952 | 4.0897 | 0.8781 | -0.0656 | 0.9429 | 0.9156 | 0.8547 | 1.0636 | 0.8000 |
| t1 | United_States | hot | q25 | 689952 | 8.7737 | 1.7589 | -0.1208 | 0.9360 | 1.3483 | 0.8570 | 1.3187 | 0.8000 |
| t2 | Bulgaria | cd | q25 | 11374 | 1.8112 | 1.1281 | -0.0089 | 0.8929 | 0.9123 | 0.8072 | 1.0193 | 0.8000 |
| t2 | Bulgaria | hot | q25 | 11374 | 2.0890 | 1.5953 | -0.0026 | 0.8791 | 0.9784 | 0.8095 | 1.1268 | 0.8000 |
| t2 | United_States | cd | q25 | 675578 | 3.7451 | 0.8519 | 0.0609 | 0.9371 | 0.8750 | 0.8622 | 1.1390 | 0.8000 |
| t2 | United_States | hot | q25 | 675578 | 6.0280 | 1.6046 | 0.1155 | 0.9437 | 1.1516 | 0.8624 | 1.4974 | 0.8000 |
| t3 | Bulgaria | cd | q25 | 8712 | 3.2507 | 0.6389 | 0.1392 | 0.7765 | 0.5723 | 0.8543 | 1.1914 | 0.8000 |
| t3 | Bulgaria | hot | q25 | 8712 | 3.3349 | 0.8828 | 0.0876 | 0.7980 | 0.8455 | 0.8545 | 1.2994 | 0.8000 |
| t3 | United_States | cd | q25 | 517464 | 3.3078 | 0.8507 | -0.0809 | 0.8955 | 0.8322 | 0.8407 | 1.0555 | 0.8000 |
| t3 | United_States | hot | q25 | 517464 | 5.2735 | 1.4816 | -0.0245 | 0.9091 | 1.1507 | 0.8436 | 1.3067 | 0.8000 |

### Pipeline B, level (c) 50 km circle x month

| test | country | unit | grid | n | nrmse | mae | bias | r | slope | coverage | mape | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t1 | Bulgaria | cd | d10 | 288 | 0.8501 | 5.8538 | -0.0431 | 0.9476 | 1.0877 | 0.5972 | 0.8184 | 0.8000 |
| t1 | Bulgaria | hot | d10 | 288 | 1.1091 | 8.6221 | -0.0633 | 0.9424 | 1.2362 | 0.6042 | 0.9341 | 0.8000 |
| t1 | United_States | cd | d10 | 672 | 0.8919 | 10.6850 | 0.0013 | 0.9647 | 0.9075 | 0.5923 | 0.7791 | 0.8000 |
| t1 | United_States | hot | d10 | 672 | 1.7334 | 25.6033 | -0.0937 | 0.9419 | 1.2970 | 0.6265 | 0.9931 | 0.8000 |
| t2 | Bulgaria | cd | d10 | 282 | 0.6537 | 7.6463 | 0.0004 | 0.9684 | 1.0964 | 0.6560 | 0.7809 | 0.8000 |
| t2 | Bulgaria | hot | d10 | 282 | 0.8813 | 11.7991 | -0.0005 | 0.9579 | 1.1817 | 0.6915 | 0.8423 | 0.8000 |
| t2 | United_States | cd | d10 | 658 | 0.8352 | 10.2256 | 0.1449 | 0.9686 | 0.8750 | 0.6398 | 0.9008 | 0.8000 |
| t2 | United_States | hot | d10 | 658 | 1.1586 | 21.7768 | 0.1851 | 0.9497 | 0.9318 | 0.6930 | 1.4377 | 0.8000 |
| t3 | Bulgaria | cd | d10 | 216 | 0.7606 | 3.8593 | 0.0819 | 0.8976 | 0.7672 | 0.6204 | 0.8498 | 0.8000 |
| t3 | Bulgaria | hot | d10 | 216 | 0.7693 | 5.1802 | 0.1202 | 0.9051 | 0.7844 | 0.6574 | 0.9554 | 0.8000 |
| t3 | United_States | cd | d10 | 504 | 1.3399 | 12.5084 | 0.0443 | 0.9246 | 0.7685 | 0.5813 | 0.7441 | 0.8000 |
| t3 | United_States | hot | d10 | 504 | 1.5514 | 27.3188 | 0.0120 | 0.9015 | 0.7946 | 0.6270 | 1.0359 | 0.8000 |

### Pipeline B, level (d) d10 cell x month (information)

| test | country | unit | grid | n | nrmse | mae | bias | r | slope | coverage | mape | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t1 | Bulgaria | cd | d10 | 58752 | 4.6500 | 0.2399 | 0.0076 | 0.7166 | 0.6470 | 0.9330 | 1.1399 | 0.8000 |
| t1 | Bulgaria | hot | d10 | 58752 | 5.0496 | 0.3299 | -0.0125 | 0.7091 | 0.7520 | 0.9324 | 1.2286 | 0.8000 |
| t1 | United_States | cd | d10 | 3265920 | 6.5715 | 0.2343 | -0.0656 | 0.9034 | 0.8635 | 0.9438 | 1.1041 | 0.8000 |
| t1 | United_States | hot | d10 | 3265920 | 11.6578 | 0.4430 | -0.1208 | 0.9036 | 1.2720 | 0.9438 | 1.3232 | 0.8000 |
| t2 | Bulgaria | cd | d10 | 57528 | 3.5452 | 0.3260 | -0.0089 | 0.7494 | 0.6886 | 0.9155 | 1.0861 | 0.8000 |
| t2 | Bulgaria | hot | d10 | 57528 | 3.8419 | 0.4520 | -0.0026 | 0.7439 | 0.7631 | 0.9149 | 1.1750 | 0.8000 |
| t2 | United_States | cd | d10 | 3197880 | 6.5166 | 0.2291 | 0.0609 | 0.8882 | 0.8136 | 0.9468 | 1.1666 | 0.8000 |
| t2 | United_States | hot | d10 | 3197880 | 9.5246 | 0.4130 | 0.1155 | 0.9062 | 1.0889 | 0.9460 | 1.4718 | 0.8000 |
| t3 | Bulgaria | cd | d10 | 44064 | 7.0976 | 0.1566 | 0.1482 | 0.6535 | 0.4824 | 0.9535 | 1.1868 | 0.8000 |
| t3 | Bulgaria | hot | d10 | 44064 | 7.7131 | 0.2159 | 0.0975 | 0.6853 | 0.7500 | 0.9530 | 1.2658 | 0.8000 |
| t3 | United_States | cd | d10 | 2449440 | 5.7662 | 0.2248 | -0.0893 | 0.8377 | 0.7677 | 0.9381 | 1.0949 | 0.8000 |
| t3 | United_States | hot | d10 | 2449440 | 8.8089 | 0.3770 | -0.0243 | 0.8732 | 1.1197 | 0.9383 | 1.2985 | 0.8000 |

